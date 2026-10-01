import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
#if canImport(VisionKit)
import VisionKit
#endif

enum DocumentScanError: LocalizedError, Equatable {
    case noPages
    case pdfConversionFailed
    case cameraFailed

    var errorDescription: String? {
        switch self {
        case .noPages:
            "La scansione non contiene pagine. Riprova o importa una foto o un PDF."
        case .pdfConversionFailed:
            "Non è stato possibile creare il PDF della scansione. Nessun dato è stato salvato: riprova o importa una foto o un PDF."
        case .cameraFailed:
            "La scansione non è riuscita. Nessun dato è stato salvato: riprova o importa una foto o un PDF."
        }
    }
}

struct AddDocumentView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var documentType: DocumentType = .medicalReport
    @State private var documentDate = Date()
    @State private var description = ""
    @State private var linkedModuleId: String?
    private let linkedAppointmentId: String?
    private let hidesClassification: Bool
    @State private var selectedAttachment: AttachmentMetadata?
    @State private var selectedAttachmentURL: URL?
    @State private var isImportingFile = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var isScanningDocument = false
    @State private var statusMessage: String?
    @State private var recognizedText = ""
    @State private var isRecognizingText = false
    @State private var isSaving = false
    private let onSaved: ((HealthDocument) -> Void)?

    init(
        initialType: DocumentType = .medicalReport,
        initialTitle: String = "",
        linkedModuleId: String? = nil,
        linkedAppointmentId: String? = nil,
        hidesClassification: Bool = false,
        onSaved: ((HealthDocument) -> Void)? = nil
    ) {
        _title = State(initialValue: initialTitle)
        _documentType = State(initialValue: initialType)
        _linkedModuleId = State(initialValue: linkedModuleId)
        self.linkedAppointmentId = linkedAppointmentId
        self.hidesClassification = hidesClassification
        self.onSaved = onSaved
    }

    var body: some View {
        Form {
            Section("Documento") {
                TextField("Titolo", text: $title)

                if !hidesClassification {
                    Picker("Tipo", selection: $documentType) {
                        ForEach(DocumentType.allCases) { type in
                            Text(type.label).tag(type)
                        }
                    }

                    Picker("Collega al modulo", selection: $linkedModuleId) {
                        Text("Nessun modulo").tag(String?.none)
                        ForEach(DocumentModuleLink.allCases) { module in
                            Text(module.title).tag(Optional(module.rawValue))
                        }
                    }
                }

                DatePicker("Data documento", selection: $documentDate, displayedComponents: [.date])

                TextField("Note o sintesi", text: $description, axis: .vertical)
                    .lineLimit(2...6)
            }

            Section("Allegato") {
                Button { isImportingFile = true } label: {
                    Label("Scegli un file", systemImage: "paperclip")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label("Scegli una foto dalla libreria", systemImage: "photo.on.rectangle")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                #if !targetEnvironment(macCatalyst)
                Button { isScanningDocument = true } label: {
                    Label("Scansiona un documento", systemImage: "doc.viewfinder")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                #endif

                if let selectedAttachment {
                    Label(selectedAttachment.name, systemImage: "doc")
                        .font(.subheadline)

                    if let pageCount = selectedAttachment.pageCount {
                        Text("PDF scansionato · \(pageCount) pagine")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if supportsTextRecognition(selectedAttachment) {
                        Button {
                            recognizeText()
                        } label: {
                            Label(
                                isRecognizingText ? "Estrazione in corso" : "Estrai testo sul dispositivo",
                                systemImage: "text.viewfinder"
                            )
                        }
                        .disabled(isRecognizingText)
                    }
                }

                Text("Il file viene salvato prima nel vault locale cifrato. Se la sincronizzazione Hub è configurata, verrà inviato in coda e potrai aprirlo anche dal Web.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if let statusMessage {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }

            if !recognizedText.isEmpty {
                Section("Testo estratto") {
                    TextField("Controlla e correggi il testo", text: $recognizedText, axis: .vertical)
                        .lineLimit(8...18)
                    Text("Il testo viene salvato come metadato del documento solo dopo la tua conferma.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Aggiungi documento")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Annulla") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva") {
                    Task { await save() }
                }
                .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
            }
        }
        .fileImporter(
            isPresented: $isImportingFile,
            allowedContentTypes: [.pdf, .image, .plainText, .rtf, .data],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                selectedAttachment = attachmentMetadata(for: url)
                selectedAttachmentURL = url
                if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    title = url.deletingPathExtension().lastPathComponent
                }
            case .failure(let error):
                statusMessage = error.localizedDescription
            }
        }
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task { await loadPhoto(item) }
        }
        #if !targetEnvironment(macCatalyst)
        .sheet(isPresented: $isScanningDocument) {
            DocumentScannerView { pdfData, pageCount in
                selectCapturedScan(pdfData, pageCount: pageCount)
                isScanningDocument = false
            } onCancel: {
                isScanningDocument = false
            } onError: { error in
                statusMessage = error.localizedDescription
                isScanningDocument = false
            }
        }
        #endif
    }

    private func save() async {
        isSaving = true
        defer {
            isSaving = false
            removeCapturedTemporaryFile()
        }
        var attachment = selectedAttachment

        if let selectedAttachmentURL, let selectedAttachment {
            do {
                attachment = try await store.storeAttachment(from: selectedAttachmentURL, metadata: selectedAttachment)
            } catch {
                statusMessage = error.localizedDescription
                return
            }
        }

        let document = HealthDocument(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            documentType: documentType,
            documentDate: MHDDocumentDateCoding.string(from: documentDate),
            description: description.nilIfBlank,
            linkedModuleId: linkedModuleId,
            linkedAppointmentId: linkedAppointmentId,
            attachment: attachment,
            ocrText: recognizedText.nilIfBlank
        )
        store.addDocument(document)
        onSaved?(document)
        dismiss()
    }

    private func supportsTextRecognition(_ attachment: AttachmentMetadata) -> Bool {
        guard let type = UTType(attachment.type) else { return false }
        return type.conforms(to: .pdf) || type.conforms(to: .image)
    }

    private func recognizeText() {
        guard let selectedAttachmentURL else { return }
        isRecognizingText = true
        statusMessage = nil
        Task {
            do {
                let text = try await DocumentOCRService().recognizeText(at: selectedAttachmentURL)
                recognizedText = text
                statusMessage = text.isEmpty ? "Nessun testo riconosciuto." : "Testo estratto. Controllalo prima di salvare."
            } catch {
                statusMessage = error.localizedDescription
            }
            isRecognizingText = false
        }
    }

    private func attachmentMetadata(for url: URL, pageCount: Int? = nil) -> AttachmentMetadata {
        let didAccess = url.startAccessingSecurityScopedResource()
        defer {
            if didAccess {
                url.stopAccessingSecurityScopedResource()
            }
        }

        let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentTypeKey, .contentModificationDateKey])
        return AttachmentMetadata(
            name: url.lastPathComponent,
            type: values?.contentType?.identifier ?? UTType.data.identifier,
            size: values?.fileSize ?? 0,
            lastModified: values?.contentModificationDate?.timeIntervalSince1970,
            pageCount: pageCount
        )
    }

    @MainActor
    private func loadPhoto(_ item: PhotosPickerItem) async {
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else {
                statusMessage = "Impossibile leggere la foto selezionata."
                return
            }
            selectCapturedImage(image, suggestedName: "Foto documento")
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func selectCapturedImage(_ image: UIImage, suggestedName: String) {
        guard let data = image.jpegData(compressionQuality: 0.9) else { return }
        removeCapturedTemporaryFile()
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("mhd-document-\(UUID().uuidString).jpg")
        do {
            try data.write(to: url, options: [.atomic, .completeFileProtection])
            selectedAttachmentURL = url
            selectedAttachment = attachmentMetadata(for: url)
            if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                title = suggestedName
            }
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func selectCapturedScan(_ pdfData: Data, pageCount: Int) {
        guard pageCount > 0 else {
            statusMessage = "La scansione non contiene pagine."
            return
        }
        removeCapturedTemporaryFile()
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("mhd-document-\(UUID().uuidString).pdf")
        do {
            try pdfData.write(to: url, options: [.atomic, .completeFileProtection])
            selectedAttachmentURL = url
            selectedAttachment = attachmentMetadata(for: url, pageCount: pageCount)
            if title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                title = pageCount == 1 ? "Scansione" : "Scansione (\(pageCount) pagine)"
            }
            statusMessage = "Scansione PDF pronta: \(pageCount) pagine."
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func removeCapturedTemporaryFile() {
        guard let selectedAttachmentURL,
              selectedAttachmentURL.lastPathComponent.hasPrefix("mhd-document-") else { return }
        LocalVaultStore().removeMaterializedFile(at: selectedAttachmentURL)
    }
}

#if !targetEnvironment(macCatalyst)
private struct DocumentScannerView: UIViewControllerRepresentable {
    var onScan: (Data, Int) -> Void
    var onCancel: () -> Void
    var onError: (DocumentScanError) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, @preconcurrency VNDocumentCameraViewControllerDelegate {
        var parent: DocumentScannerView

        init(parent: DocumentScannerView) { self.parent = parent }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFinishWith scan: VNDocumentCameraScan
        ) {
            guard scan.pageCount > 0 else {
                parent.onError(.noPages)
                return
            }
            let pages = (0..<scan.pageCount).map { scan.imageOfPage(at: $0) }
            do {
                parent.onScan(try DocumentScanPDFEncoder.makePDF(from: pages), pages.count)
            } catch {
                parent.onError(.pdfConversionFailed)
            }
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            parent.onCancel()
        }

        func documentCameraViewController(
            _ controller: VNDocumentCameraViewController,
            didFailWithError error: Error
        ) {
            parent.onError(.cameraFailed)
        }
    }
}
#endif

/// Converts every page from VisionKit into one standard PDF attachment. The
/// vault already encrypts arbitrary attachment bytes, so keeping the scan as
/// one PDF preserves page order and remains preview/OCR/Hub compatible.
enum DocumentScanPDFEncoder {
    enum Error: Swift.Error, Equatable {
        case noPages
        case invalidPageSize
    }

    static func makePDF(from pages: [UIImage]) throws -> Data {
        guard !pages.isEmpty else { throw Error.noPages }
        guard pages.allSatisfy({ $0.size.width > 0 && $0.size.height > 0 }) else {
            throw Error.invalidPageSize
        }

        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [
            kCGPDFContextCreator as String: "MyHealthData iOS",
            kCGPDFContextTitle as String: "MyHealthData document scan"
        ]
        let renderer = UIGraphicsPDFRenderer(bounds: .zero, format: format)
        return renderer.pdfData { context in
            for page in pages {
                let pageSize = page.size
                context.beginPage(withBounds: CGRect(origin: .zero, size: pageSize), pageInfo: [:])
                page.draw(in: CGRect(origin: .zero, size: pageSize))
            }
        }
    }
}
