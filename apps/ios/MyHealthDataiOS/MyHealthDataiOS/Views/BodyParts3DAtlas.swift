import Foundation
import zlib

struct BodyParts3DAtlasManifest: Decodable, Sendable {
    let version: String
    let parts: [BodyParts3DPart]
    let chunks: [BodyParts3DChunk]
}

struct BodyParts3DPart: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let conceptId: String
    let system: String
    let chunk: Int
    let positions: Int
    let normals: Int
    let indices: Int
    let vertexCount: Int
    let indexCount: Int
    let bounds: [[Float]]
}

struct BodyParts3DChunk: Decodable, Sendable {
    let url: String
    let bytes: Int
    let gzip: String?
    let gzipBytes: Int?
}

/// A bounds-checked, decompressed mesh payload. The actor-facing loader returns
/// only the pain-relevant systems and copies their vertex/index spans out of a
/// single chunk before releasing its 4 MB working buffer.
struct BodyParts3DMeshData: Identifiable, Sendable {
    let part: BodyParts3DPart
    let positions: Data
    let normals: Data
    let indices: Data

    var id: String { part.id }
}

enum BodyParts3DAtlasError: Error, LocalizedError {
    case missingManifest
    case missingChunk(Int)
    case invalidManifest
    case invalidChunk(Int)
    case decompressionFailed(Int32)
    case truncatedChunk(expected: Int, actual: Int)
    case invalidMesh(String)

    var errorDescription: String? {
        switch self {
        case .missingManifest:
            "Atlante anatomico non disponibile."
        case .missingChunk(let index):
            "Chunk anatomico \(index) non disponibile."
        case .invalidManifest:
            "Manifest anatomico non valido."
        case .invalidChunk(let index):
            "Chunk anatomico \(index) non valido."
        case .decompressionFailed(let status):
            "Decompressione anatomica non riuscita (\(status))."
        case .truncatedChunk(let expected, let actual):
            "Chunk anatomico incompleto (\(actual)/\(expected) byte)."
        case .invalidMesh(let id):
            "Geometria anatomica non valida (\(id))."
        }
    }
}

enum BodyParts3DAtlas {
    private static let painSystems: Set<String> = ["integumentary", "skeletal", "muscular", "nervous"]
    private static let maximumChunkBytes = 16 * 1_024 * 1_024

    /// File I/O, manifest decoding, inflation, validation and extraction are
    /// performed by the detached worker that calls this synchronous loader.
    static func loadPainLayer(bundle: Bundle = .main) throws -> [BodyParts3DMeshData] {
        guard let manifestURL = bundle.url(forResource: "atlas", withExtension: "json") else {
            throw BodyParts3DAtlasError.missingManifest
        }
        let manifestData = try Data(contentsOf: manifestURL, options: .mappedIfSafe)
        let manifest = try JSONDecoder().decode(BodyParts3DAtlasManifest.self, from: manifestData)
        guard manifest.version == "BodyParts3D 4.0",
              !manifest.parts.isEmpty,
              !manifest.chunks.isEmpty else {
            throw BodyParts3DAtlasError.invalidManifest
        }

        let requiredChunkIndexes = Set(manifest.parts.lazy
            .filter { painSystems.contains($0.system) }
            .map(\.chunk))
        guard !requiredChunkIndexes.isEmpty else { throw BodyParts3DAtlasError.invalidManifest }

        var chunkURLs: [Int: URL] = [:]
        for index in requiredChunkIndexes {
            guard manifest.chunks.indices.contains(index) else {
                throw BodyParts3DAtlasError.missingChunk(index)
            }
            let chunk = manifest.chunks[index]
            guard let gzipPath = chunk.gzip,
                  let url = bundle.url(forResource: URL(fileURLWithPath: gzipPath).deletingPathExtension().lastPathComponent,
                                       withExtension: "gz") else {
                throw BodyParts3DAtlasError.missingChunk(index)
            }
            chunkURLs[index] = url
        }

        return try extractPainMeshes(manifest: manifest, chunkURLs: chunkURLs)
    }

    private static func extractPainMeshes(
        manifest: BodyParts3DAtlasManifest,
        chunkURLs: [Int: URL]
    ) throws -> [BodyParts3DMeshData] {
        var result: [BodyParts3DMeshData] = []
        for chunkIndex in chunkURLs.keys.sorted() {
            if Task.isCancelled { throw CancellationError() }
            guard let chunkURL = chunkURLs[chunkIndex], manifest.chunks.indices.contains(chunkIndex) else {
                throw BodyParts3DAtlasError.missingChunk(chunkIndex)
            }
            let descriptor = manifest.chunks[chunkIndex]
            guard descriptor.bytes > 0, descriptor.bytes <= maximumChunkBytes else {
                throw BodyParts3DAtlasError.invalidChunk(chunkIndex)
            }
            let compressed = try Data(contentsOf: chunkURL, options: .mappedIfSafe)
            if let expectedGzipBytes = descriptor.gzipBytes, compressed.count != expectedGzipBytes {
                throw BodyParts3DAtlasError.truncatedChunk(expected: expectedGzipBytes, actual: compressed.count)
            }
            let bytes = try inflateGzip(compressed, expectedBytes: descriptor.bytes)

            for part in manifest.parts where part.chunk == chunkIndex && painSystems.contains(part.system) {
                if Task.isCancelled { throw CancellationError() }
                result.append(try makeMeshData(part: part, chunk: bytes))
            }
        }
        guard !result.isEmpty else { throw BodyParts3DAtlasError.invalidManifest }
        return result
    }

    private static func makeMeshData(part: BodyParts3DPart, chunk: Data) throws -> BodyParts3DMeshData {
        guard part.vertexCount > 0,
              part.indexCount >= 3,
              part.indexCount.isMultiple(of: 3),
              part.bounds.count == 2,
              part.bounds.allSatisfy({ $0.count == 3 }) else {
            throw BodyParts3DAtlasError.invalidMesh(part.id)
        }

        let positionLength = try checkedProduct(part.vertexCount, 12, id: part.id)
        let normalLength = try checkedProduct(part.vertexCount, 6, id: part.id)
        let indexLength = try checkedProduct(part.indexCount, 4, id: part.id)
        let positionsRange = try checkedRange(offset: part.positions, length: positionLength, total: chunk.count, id: part.id)
        let normalsRange = try checkedRange(offset: part.normals, length: normalLength, total: chunk.count, id: part.id)
        let indicesRange = try checkedRange(offset: part.indices, length: indexLength, total: chunk.count, id: part.id)

        let indicesSlice = chunk[indicesRange]
        try validateIndices(indicesSlice, vertexCount: part.vertexCount, id: part.id)
        let normals = try normalizedNormals(chunk[normalsRange], id: part.id)

        return BodyParts3DMeshData(
            part: part,
            positions: Data(chunk[positionsRange]),
            normals: normals,
            indices: Data(indicesSlice)
        )
    }

    private static func checkedProduct(_ lhs: Int, _ rhs: Int, id: String) throws -> Int {
        let (value, overflow) = lhs.multipliedReportingOverflow(by: rhs)
        guard !overflow, value >= 0 else { throw BodyParts3DAtlasError.invalidMesh(id) }
        return value
    }

    private static func checkedRange(offset: Int, length: Int, total: Int, id: String) throws -> Range<Int> {
        guard offset >= 0, length > 0, offset <= total, length <= total - offset else {
            throw BodyParts3DAtlasError.invalidMesh(id)
        }
        return offset..<(offset + length)
    }

    private static func validateIndices(_ data: Data.SubSequence, vertexCount: Int, id: String) throws {
        try data.withUnsafeBytes { rawBytes in
            guard let bytes = rawBytes.baseAddress?.assumingMemoryBound(to: UInt8.self) else {
                throw BodyParts3DAtlasError.invalidMesh(id)
            }
            for offset in stride(from: 0, to: data.count, by: 4) {
                let value = UInt32(bytes[offset])
                    | (UInt32(bytes[offset + 1]) << 8)
                    | (UInt32(bytes[offset + 2]) << 16)
                    | (UInt32(bytes[offset + 3]) << 24)
                guard value < vertexCount else { throw BodyParts3DAtlasError.invalidMesh(id) }
            }
        }
    }

    private static func normalizedNormals(_ data: Data.SubSequence, id: String) throws -> Data {
        var normalized = [Float](repeating: 0, count: data.count / 2)
        try data.withUnsafeBytes { rawBytes in
            guard let bytes = rawBytes.baseAddress?.assumingMemoryBound(to: UInt8.self) else {
                throw BodyParts3DAtlasError.invalidMesh(id)
            }
            for componentIndex in normalized.indices {
                let offset = componentIndex * 2
                let bits = UInt16(bytes[offset]) | (UInt16(bytes[offset + 1]) << 8)
                let component = Int16(bitPattern: bits)
                normalized[componentIndex] = Float(max(-32_767, min(32_767, Int(component)))) / 32_767
            }
        }
        return normalized.withUnsafeBytes { Data($0) }
    }

    private static func inflateGzip(_ compressed: Data, expectedBytes: Int) throws -> Data {
        guard expectedBytes > 0,
              expectedBytes <= maximumChunkBytes,
              compressed.count <= maximumChunkBytes else {
            throw BodyParts3DAtlasError.invalidManifest
        }

        var output = Data(count: expectedBytes)
        let result = compressed.withUnsafeBytes { inputBuffer in
            output.withUnsafeMutableBytes { outputBuffer in
                var stream = z_stream()
                let initialization = inflateInit2_(
                    &stream,
                    15 + 32,
                    ZLIB_VERSION,
                    Int32(MemoryLayout<z_stream>.size)
                )
                guard initialization == Z_OK,
                      let inputBase = inputBuffer.baseAddress,
                      let outputBase = outputBuffer.baseAddress,
                      compressed.count <= Int(UInt32.max),
                      expectedBytes <= Int(UInt32.max) else {
                    if initialization == Z_OK { inflateEnd(&stream) }
                    return (initialization == Z_OK ? Z_STREAM_ERROR : initialization, 0)
                }

                stream.next_in = UnsafeMutablePointer(mutating: inputBase.assumingMemoryBound(to: Bytef.self))
                stream.avail_in = uInt(compressed.count)
                stream.next_out = outputBase.assumingMemoryBound(to: Bytef.self)
                stream.avail_out = uInt(expectedBytes)
                let status = inflate(&stream, Z_FINISH)
                let decodedBytes = Int(stream.total_out)
                inflateEnd(&stream)
                return (status, decodedBytes)
            }
        }

        guard result.0 == Z_STREAM_END else { throw BodyParts3DAtlasError.decompressionFailed(result.0) }
        guard result.1 == expectedBytes else {
            throw BodyParts3DAtlasError.truncatedChunk(expected: expectedBytes, actual: result.1)
        }
        return output
    }
}
