import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    nonisolated private static let maximumFileCount = 10
    nonisolated private static let maximumFileSize = 50 * 1_024 * 1_024
    nonisolated private static let allowedExtensions: Set<String> = [
        "pdf", "png", "jpg", "jpeg", "heic", "heif", "tif", "tiff",
        "txt", "rtf", "csv", "json", "xml",
        "doc", "docx", "xls", "xlsx"
    ]

    private let appGroup = "group.org.myhealthdata.shared"
    private let inboxFolder = "SharedDocumentsInbox"
    private var hasStarted = false

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !hasStarted else { return }
        hasStarted = true
        Task { await receiveSharedFiles() }
    }

    private func receiveSharedFiles() async {
        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []

        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
            complete(with: CocoaError(.fileNoSuchFile)); return
        }

        let inbox = container.appending(path: inboxFolder, directoryHint: .isDirectory)
        do {
            try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
            var imported = 0
            for provider in providers.prefix(Self.maximumFileCount) {
                if try await copySharedFile(from: provider, into: inbox) {
                    imported += 1
                }
            }
            imported > 0 ? complete() : complete(with: CocoaError(.fileReadUnsupportedScheme))
        } catch {
            complete(with: error)
        }
    }

    private func copySharedFile(from provider: NSItemProvider, into inbox: URL) async throws -> Bool {
        let identifier = provider.registeredTypeIdentifiers.first { identifier in
            guard let type = UTType(identifier) else { return false }
            return type.conforms(to: .pdf)
                || type.conforms(to: .image)
                || type.conforms(to: .text)
                || type.conforms(to: .spreadsheet)
                || type.conforms(to: .presentation)
                || type.conforms(to: .data)
        }
        guard let identifier else { return false }
        let suggestedName = provider.suggestedName?.trimmingCharacters(in: .whitespacesAndNewlines)

        return try await withCheckedThrowingContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: identifier) { url, error in
                do {
                    if let error { throw error }
                    guard let url else {
                        continuation.resume(returning: false)
                        return
                    }
                    let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
                    guard values.isRegularFile == true,
                          let fileSize = values.fileSize,
                          fileSize > 0,
                          fileSize <= Self.maximumFileSize else {
                        throw CocoaError(.fileReadTooLarge)
                    }
                    let fileExtension = url.pathExtension.lowercased()
                    guard Self.allowedExtensions.contains(fileExtension) else {
                        throw CocoaError(.fileReadUnsupportedScheme)
                    }
                    let extensionSuffix = url.pathExtension.isEmpty ? "" : ".\(url.pathExtension)"
                    let baseName = (suggestedName?.isEmpty == false ? suggestedName : nil)
                        ?? url.deletingPathExtension().lastPathComponent
                    let completeName = baseName.hasSuffix(extensionSuffix) ? baseName : baseName + extensionSuffix
                    let safeName = completeName.replacingOccurrences(of: "/", with: "-")
                    let destination = inbox.appending(path: "\(UUID().uuidString)__\(safeName)")
                    try FileManager.default.copyItem(at: url, to: destination)
                    try FileManager.default.setAttributes(
                        [.protectionKey: FileProtectionType.complete],
                        ofItemAtPath: destination.path
                    )
                    continuation.resume(returning: true)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func complete(with error: Error? = nil) {
        DispatchQueue.main.async {
            if let error { self.extensionContext?.cancelRequest(withError: error) }
            else { self.extensionContext?.completeRequest(returningItems: nil) }
        }
    }
}
