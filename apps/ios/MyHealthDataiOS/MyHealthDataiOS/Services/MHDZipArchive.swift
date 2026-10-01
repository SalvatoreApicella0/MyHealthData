import Foundation
import CryptoKit
import UniformTypeIdentifiers
import SwiftUI

struct MHDZipArchive {
    enum ArchiveError: Error { case invalidArchive, unsupportedCompression, checksumMismatch }

    static func make(entries: [(String, Data)]) throws -> Data {
        var output = Data()
        var central = Data()
        var offset: UInt32 = 0

        for (name, data) in entries {
            let nameData = Data(name.utf8)
            let crc = crc32(data)
            let local = header(signature: 0x04034b50, crc: crc, size: UInt32(data.count), nameLength: UInt16(nameData.count), extraLength: 0)
            output.append(local)
            output.append(nameData)
            output.append(data)

            let directory = centralHeader(crc: crc, size: UInt32(data.count), nameLength: UInt16(nameData.count), offset: offset)
            central.append(directory)
            central.append(nameData)
            offset += UInt32(local.count + nameData.count + data.count)
        }

        let centralOffset = UInt32(output.count)
        output.append(central)
        output.append(endOfCentralDirectory(count: UInt16(entries.count), size: UInt32(central.count), offset: centralOffset))
        return output
    }

    static func extract(_ data: Data) throws -> [String: Data] {
        var cursor = 0
        var result: [String: Data] = [:]
        while cursor + 4 <= data.count {
            let signature = try u32(data, at: cursor)
            guard signature == 0x04034b50 else { break }
            guard cursor + 30 <= data.count else { throw ArchiveError.invalidArchive }
            let method = try u16(data, at: cursor + 8)
            guard method == 0 else { throw ArchiveError.unsupportedCompression }
            let expectedCRC = try u32(data, at: cursor + 14)
            let size = Int(try u32(data, at: cursor + 18))
            let nameLength = Int(try u16(data, at: cursor + 26))
            let extraLength = Int(try u16(data, at: cursor + 28))
            let nameStart = cursor + 30
            let payloadStart = nameStart + nameLength + extraLength
            let payloadEnd = payloadStart + size
            guard payloadEnd <= data.count else { throw ArchiveError.invalidArchive }
            guard let name = String(data: data[nameStart..<(nameStart + nameLength)], encoding: .utf8) else {
                throw ArchiveError.invalidArchive
            }
            let payload = Data(data[payloadStart..<payloadEnd])
            guard crc32(payload) == expectedCRC else { throw ArchiveError.checksumMismatch }
            result[name] = payload
            cursor = payloadEnd
        }
        guard !result.isEmpty else { throw ArchiveError.invalidArchive }
        return result
    }

    private static func header(signature: UInt32, crc: UInt32, size: UInt32, nameLength: UInt16, extraLength: UInt16) -> Data {
        var data = Data()
        append(&data, signature); append(&data, UInt16(20)); append(&data, UInt16(0)); append(&data, UInt16(0))
        append(&data, UInt16(0)); append(&data, UInt16(0)); append(&data, crc); append(&data, size); append(&data, size)
        append(&data, nameLength); append(&data, extraLength)
        return data
    }

    private static func centralHeader(crc: UInt32, size: UInt32, nameLength: UInt16, offset: UInt32) -> Data {
        var data = Data()
        append(&data, UInt32(0x02014b50)); append(&data, UInt16(20)); append(&data, UInt16(20)); append(&data, UInt16(0)); append(&data, UInt16(0))
        append(&data, UInt16(0)); append(&data, UInt16(0)); append(&data, crc); append(&data, size); append(&data, size)
        append(&data, nameLength); append(&data, UInt16(0)); append(&data, UInt16(0)); append(&data, UInt16(0)); append(&data, UInt16(0)); append(&data, UInt32(0)); append(&data, offset)
        return data
    }

    private static func endOfCentralDirectory(count: UInt16, size: UInt32, offset: UInt32) -> Data {
        var data = Data(); append(&data, UInt32(0x06054b50)); append(&data, UInt16(0)); append(&data, UInt16(0)); append(&data, count); append(&data, count); append(&data, size); append(&data, offset); append(&data, UInt16(0)); return data
    }

    private static func append<T: FixedWidthInteger>(_ data: inout Data, _ value: T) {
        var littleEndian = value.littleEndian
        withUnsafeBytes(of: &littleEndian) { data.append(contentsOf: $0) }
    }

    private static func u16(_ data: Data, at offset: Int) throws -> UInt16 {
        guard offset >= 0, offset <= data.count - 2 else { throw ArchiveError.invalidArchive }
        return data.withUnsafeBytes { bytes in
            let low = UInt16(bytes[offset])
            let high = UInt16(bytes[offset + 1])
            return low | (high << 8)
        }
    }

    private static func u32(_ data: Data, at offset: Int) throws -> UInt32 {
        guard offset >= 0, offset <= data.count - 4 else { throw ArchiveError.invalidArchive }
        return data.withUnsafeBytes { bytes in
            let byte0 = UInt32(bytes[offset])
            let byte1 = UInt32(bytes[offset + 1])
            let byte2 = UInt32(bytes[offset + 2])
            let byte3 = UInt32(bytes[offset + 3])
            return byte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24)
        }
    }

    private static func crc32(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xffffffff
        for byte in data {
            crc ^= UInt32(byte)
            for _ in 0..<8 { crc = (crc >> 1) ^ (0xedb88320 &- (crc & 1)) }
        }
        return ~crc
    }
}

struct MHDZipDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.mhdZip] }
    var data: Data
    init(data: Data = Data()) { self.data = data }
    init(configuration: ReadConfiguration) throws {
        guard let contents = configuration.file.regularFileContents else { throw AppError.importFailed("selected backup did not contain readable data") }
        data = contents
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

extension UTType {
    static let mhdZip = UTType(filenameExtension: "mhdzip") ?? .data
}
