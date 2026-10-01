import Foundation
import ImageIO
import PDFKit
import Vision

struct DocumentOCRService {
    enum OCRError: LocalizedError {
        case unsupportedFile
        case unreadableDocument

        var errorDescription: String? {
            switch self {
            case .unsupportedFile: "Questo tipo di file non supporta l’estrazione del testo."
            case .unreadableDocument: "Non è stato possibile leggere il documento."
            }
        }
    }

    func recognizeText(at url: URL) async throws -> String {
        try await Task.detached(priority: .userInitiated) {
            let didAccess = url.startAccessingSecurityScopedResource()
            defer { if didAccess { url.stopAccessingSecurityScopedResource() } }

            let extensionName = url.pathExtension.lowercased()
            let images: [CGImage]
            if extensionName == "pdf" {
                guard let document = PDFDocument(url: url) else { throw OCRError.unreadableDocument }
                if let embeddedText = document.string?.trimmingCharacters(in: .whitespacesAndNewlines), embeddedText.count > 40 {
                    return embeddedText
                }
                images = (0..<min(document.pageCount, 12)).compactMap { index in
                    document.page(at: index)?
                        .thumbnail(of: CGSize(width: 1_800, height: 2_400), for: .mediaBox)
                        .cgImage
                }
            } else {
                guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
                    throw OCRError.unsupportedFile
                }
                images = [image]
            }

            guard !images.isEmpty else { throw OCRError.unreadableDocument }
            var pages: [String] = []
            for image in images {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = true
                request.recognitionLanguages = ["it-IT", "en-US"]
                try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
                let page = (request.results ?? [])
                    .compactMap { $0.topCandidates(1).first?.string }
                    .joined(separator: "\n")
                if !page.isEmpty { pages.append(page) }
            }
            return pages.joined(separator: "\n\n")
        }.value
    }
}
