import Foundation
import UniformTypeIdentifiers

enum MHDAppGroup {
    static let identifier = "group.org.myhealthdata.shared"
    static let inboxFolder = "SharedDocumentsInbox"
    static let maximumSharedDocumentSize = 50 * 1_024 * 1_024
    static let allowedSharedDocumentExtensions: Set<String> = [
        "pdf", "png", "jpg", "jpeg", "heic", "heif", "tif", "tiff",
        "txt", "rtf", "csv", "json", "xml",
        "doc", "docx", "xls", "xlsx"
    ]

    static func inboxURL(create: Bool = true) throws -> URL {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier) else {
            throw CocoaError(.fileNoSuchFile)
        }
        let inbox = container.appending(path: inboxFolder, directoryHint: .isDirectory)
        if create { try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true) }
        return inbox
    }
}

@MainActor
extension HealthDataStore {
    func importDocumentsFromShareExtension() async {
        guard isLoaded else { return }
        guard let inbox = try? MHDAppGroup.inboxURL() else { return }
        let keys: Set<URLResourceKey> = [.isRegularFileKey, .fileSizeKey, .contentTypeKey, .contentModificationDateKey]
        guard let urls = try? FileManager.default.contentsOfDirectory(at: inbox, includingPropertiesForKeys: Array(keys), options: [.skipsHiddenFiles]) else { return }

        for url in urls {
            do {
                let values = try url.resourceValues(forKeys: keys)
                guard values.isRegularFile == true else { continue }
                let originalName = sharedOriginalName(url.lastPathComponent)
                let fileExtension = URL(fileURLWithPath: originalName).pathExtension.lowercased()
                guard MHDAppGroup.allowedSharedDocumentExtensions.contains(fileExtension),
                      let fileSize = values.fileSize,
                      fileSize > 0,
                      fileSize <= MHDAppGroup.maximumSharedDocumentSize else {
                    try? FileManager.default.removeItem(at: url)
                    lastError = "Documento condiviso non supportato oppure superiore a 50 MB."
                    continue
                }
                let metadata = AttachmentMetadata(
                    name: originalName,
                    type: values.contentType?.identifier ?? UTType.data.identifier,
                    size: fileSize,
                    lastModified: values.contentModificationDate?.timeIntervalSince1970
                )
                let stored = try await storeAttachment(from: url, metadata: metadata)
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withFullDate]
                addDocument(HealthDocument(
                    title: URL(fileURLWithPath: originalName).deletingPathExtension().lastPathComponent,
                    documentType: inferredDocumentType(for: originalName),
                    documentDate: formatter.string(from: values.contentModificationDate ?? .now),
                    description: "Importato dal menu Condividi",
                    attachment: stored,
                    needsClassification: true
                ))
                try FileManager.default.removeItem(at: url)
            } catch {
                lastError = "Importazione documento condiviso: \(error.localizedDescription)"
            }
        }
    }

    private func sharedOriginalName(_ storedName: String) -> String {
        guard let separator = storedName.range(of: "__") else { return storedName }
        return String(storedName[separator.upperBound...])
    }

    private func inferredDocumentType(for name: String) -> DocumentType {
        let normalized = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        let bloodTerms = ["analisi", "emocromo", "laboratorio", "blood", "lab result"]
        return bloodTerms.contains(where: normalized.contains) ? .bloodTest : .medicalReport
    }
}
