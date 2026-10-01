import SwiftUI
import QuickLook

/// The archive opens the attachment immediately. Editing metadata remains a secondary action.
struct DocumentPreviewView: View {
    @Environment(HealthDataStore.self) private var store
    let document: HealthDocument
    @State private var previewURL: URL?
    @State private var isOpening = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let attachment = document.attachment {
                VStack(spacing: 18) {
                    ProgressView().controlSize(.large)
                    Text(isOpening ? "Apertura documento…" : "Documento non disponibile")
                        .font(.headline)
                    if !isOpening {
                        Button("Riprova", action: { open(attachment) })
                            .mhdGlassButton(prominent: true)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .task { open(attachment) }
            } else {
                ContentUnavailableView("Nessun allegato", systemImage: "doc.badge.questionmark", description: Text("Questo record non contiene ancora un file da aprire."))
            }
        }
        .navigationTitle(document.title)
        .navigationBarTitleDisplayMode(.inline)
        .quickLookPreview($previewURL)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink {
                    DocumentDetailView(document: document)
                } label: {
                    Image(systemName: "info.circle")
                }
                .accessibilityLabel("Dettagli documento")
            }
        }
        .alert("Impossibile aprire il documento", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        .onDisappear {
            LocalVaultStore().removeMaterializedFile(at: previewURL)
            previewURL = nil
        }
    }

    private func open(_ attachment: AttachmentMetadata) {
        isOpening = true
        Task {
            do {
                LocalVaultStore().removeMaterializedFile(at: previewURL)
                previewURL = try await store.previewURL(for: attachment)
            } catch {
                errorMessage = error.localizedDescription
            }
            isOpening = false
        }
    }
}
struct DocumentDetailView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var document: HealthDocument
    @State private var previewURL: URL?
    @State private var isOpening = false
    @State private var isDigitizing = false
    @State private var parsedResults: [ParsedLabResult] = []
    @State private var showsLabReview = false
    @State private var errorMessage: String?

    init(document: HealthDocument) {
        _document = State(initialValue: document)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if document.needsClassification == true {
                    Label("Scegli la categoria prima di archiviarlo", systemImage: "tray.and.arrow.down.fill")
                        .font(.headline).foregroundStyle(.orange)
                        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                        .mhdGlassPanel(tint: Color.orange.opacity(0.08))
                }

                VStack(alignment: .leading, spacing: 13) {
                    Text("Documento").font(.title3.bold())
                    TextField("Titolo", text: $document.title).textFieldStyle(.roundedBorder)
                    Picker("Categoria", selection: $document.documentType) {
                        ForEach(DocumentType.allCases) { type in Text(type.label).tag(type) }
                    }
                    Picker("Collega al modulo", selection: linkedModuleId) {
                        Text("Nessun modulo").tag(String?.none)
                        ForEach(DocumentModuleLink.allCases) { module in
                            Text(module.title).tag(Optional(module.rawValue))
                        }
                    }
                    DatePicker("Data", selection: documentDate, displayedComponents: .date)
                    TextField("Descrizione", text: description, axis: .vertical)
                        .lineLimit(2...6).textFieldStyle(.roundedBorder)
                }
                .padding(18).mhdGlassPanel(tint: Color.blue.opacity(0.05))

                if let attachment = document.attachment {
                    VStack(alignment: .leading, spacing: 12) {
                        Label(attachment.name, systemImage: "lock.doc.fill")
                            .font(.headline).lineLimit(2)
                        Button(isOpening ? "Apertura…" : "Apri documento", systemImage: "doc.text.magnifyingglass") {
                            open(attachment)
                        }
                        .disabled(isOpening)
                        .frame(maxWidth: .infinity).mhdGlassButton(prominent: true)
                        if document.documentType == .bloodTest {
                            Button(isDigitizing ? "Digitalizzazione in corso…" : "Digitalizza valori", systemImage: "text.viewfinder") {
                                digitize(attachment)
                            }
                            .disabled(isDigitizing)
                            .frame(maxWidth: .infinity).mhdGlassButton()
                        }
                    }
                    .padding(18).mhdGlassPanel(tint: Color.blue.opacity(0.05))
                }

                if let text = document.ocrText, !text.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Testo acquisito").font(.title3.bold())
                        Text(text).textSelection(.enabled)
                    }
                    .padding(18).mhdGlassPanel(tint: Color.blue.opacity(0.04))
                }

                Button("Salva modifiche") { saveDocument() }
                .disabled(document.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .frame(maxWidth: .infinity).mhdGlassButton(prominent: true)
            }
            .padding(20)
        }
        .navigationTitle("Dettaglio documento")
        .navigationBarTitleDisplayMode(.inline)
        .quickLookPreview($previewURL)
        .sheet(isPresented: $showsLabReview) {
            NavigationStack {
                LabImportReviewView(results: parsedResults) { approved in
                    saveLabResults(approved)
                    showsLabReview = false
                    persistDocument()
                }
            }
        }
        .alert("Impossibile aprire il documento", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        .onDisappear {
            LocalVaultStore().removeMaterializedFile(at: previewURL)
            previewURL = nil
        }
    }

    private var description: Binding<String> {
        Binding(get: { document.description ?? "" }, set: { document.description = $0.isEmpty ? nil : $0 })
    }

    private var documentDate: Binding<Date> {
        Binding(
            get: { MHDDocumentDateCoding.date(from: document.documentDate) ?? document.createdAt },
            set: { document.documentDate = MHDDocumentDateCoding.string(from: $0) }
        )
    }

    private var linkedModuleId: Binding<String?> {
        Binding(get: { document.linkedModuleId }, set: { document.linkedModuleId = $0 })
    }

    private func open(_ attachment: AttachmentMetadata) {
        isOpening = true
        Task {
            do {
                LocalVaultStore().removeMaterializedFile(at: previewURL)
                previewURL = try await store.previewURL(for: attachment)
            }
            catch { errorMessage = error.localizedDescription }
            isOpening = false
        }
    }

    private func saveDocument() {
        guard document.documentType == .bloodTest, document.ocrText == nil, let attachment = document.attachment else {
            persistDocument(); dismiss(); return
        }
        digitize(attachment)
    }

    private func persistDocument() {
        document.needsClassification = false
        document.updatedAt = .now
        store.saveDocument(document)
    }

    private func digitize(_ attachment: AttachmentMetadata) {
        isDigitizing = true
        Task {
            var materializedURL: URL?
            defer {
                LocalVaultStore().removeMaterializedFile(at: materializedURL)
            }
            do {
                let url = try await store.previewURL(for: attachment)
                materializedURL = url
                let text = try await DocumentOCRService().recognizeText(at: url)
                document.ocrText = text.nilIfBlank
                parsedResults = LabReportParser().parse(text)
                persistDocument()
                if parsedResults.isEmpty {
                    errorMessage = "Il testo è stato acquisito, ma non ho riconosciuto valori strutturati con sufficiente sicurezza. Il referto resta consultabile e ricercabile."
                } else {
                    showsLabReview = true
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isDigitizing = false
        }
    }

    private func saveLabResults(_ results: [ParsedLabResult]) {
        let collectedAt = documentDate.wrappedValue
        store.labResults.filter { $0.linkedDocumentId == document.id }.forEach { store.deleteLabResult(id: $0.id) }
        for result in results where result.isSelected {
            store.addLabResult(LabResult(
                panelName: document.title,
                analyte: result.analyte,
                value: result.value,
                unit: result.unit,
                referenceRange: result.referenceRange,
                collectedAt: collectedAt,
                linkedDocumentId: document.id,
                referenceLow: result.referenceLow,
                referenceHigh: result.referenceHigh,
                laboratoryFlag: result.flag
            ))
        }
    }
}

private struct LabImportReviewView: View {
    @Environment(\.dismiss) private var dismiss
    @State var results: [ParsedLabResult]
    let onSave: ([ParsedLabResult]) -> Void

    var body: some View {
        List {
            Section {
                ForEach($results) { $result in
                    HStack(alignment: .top, spacing: 12) {
                        Toggle("", isOn: $result.isSelected).labelsHidden()
                        VStack(alignment: .leading, spacing: 4) {
                            TextField("Analita", text: $result.analyte).font(.headline)
                            HStack {
                                Text(result.value.formatted()).font(.title3.bold().monospacedDigit())
                                TextField("Unità", text: $result.unit).foregroundStyle(.secondary)
                            }
                            if let range = result.referenceRange { Text("Intervallo: \(range)").font(.caption).foregroundStyle(.secondary) }
                            if let flag = result.flag { Label(flag, systemImage: "exclamationmark.triangle.fill").font(.caption.bold()).foregroundStyle(.orange) }
                        }
                    }.padding(.vertical, 6)
                }
            } header: {
                Text("Controlla i valori riconosciuti")
            } footer: {
                Text("Il riconoscimento automatico può sbagliare righe, unità o intervalli. Salva solo i valori verificati sul PDF.")
            }
        }
        .navigationTitle("Revisione analisi")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("Salva selezionati") { onSave(results); dismiss() }.disabled(!results.contains(where: \.isSelected)) }
        }
    }
}
