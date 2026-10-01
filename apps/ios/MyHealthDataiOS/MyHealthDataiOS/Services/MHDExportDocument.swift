import SwiftUI
import UniformTypeIdentifiers

extension UTType {
    static let mhdJSON = UTType(filenameExtension: "json") ?? .json
}

struct MHDExportDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json, .mhdJSON] }

    var data: Data

    init(data: Data = Data()) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw AppError.importFailed("selected file did not contain readable data")
        }
        self.data = data
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
