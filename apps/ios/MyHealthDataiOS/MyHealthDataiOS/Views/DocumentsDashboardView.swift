import SwiftUI
import QuickLook

struct DocumentsDashboardView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var search = ""
    @State private var previewURL: URL?
    @State private var isOpening = false
    @State private var errorMessage: String?
    @State private var isAddingDocument = false

    private var documents: [HealthDocument] {
        store.snapshot.documents
            .filter {
                search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) ||
                    ($0.description?.localizedCaseInsensitiveContains(search) ?? false) ||
                    ($0.ocrText?.localizedCaseInsensitiveContains(search) ?? false)
            }
            .sorted { $0.documentDate > $1.documentDate }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                MHDModuleHeader(
                    title: "Archivio documenti",
                    subtitle: "Allegati collegati a visite, moduli e percorsi",
                    symbol: "folder.fill",
                    tint: .blue
                )

                Button {
                    isAddingDocument = true
                } label: {
                    Label("Aggiungi documento", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                }
                .font(.headline)
                .mhdGlassButton(prominent: true)

                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Cerca per titolo o contenuto", text: $search)
                        .textInputAutocapitalization(.never)
                }
                .padding(.horizontal, 15)
                .frame(minHeight: 46)
                .mhdGlassPanel(tint: Color.blue.opacity(0.04))

                Text("I documenti si aggiungono nel punto in cui nascono: visita, analisi, vista, farmaci o altro modulo. Qui restano sempre disponibili.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)

                if documents.isEmpty {
                    ContentUnavailableView("Nessun documento", systemImage: "folder", description: Text("Importa PDF, foto o scansioni e ritrovali tramite titolo o testo OCR."))
                        .frame(minHeight: 320)
                } else {
                    ForEach(documents) { document in
                        Button { open(document) } label: {
                        HStack(spacing: 12) {
                            Image(systemName: documentIcon(document.documentType)).foregroundStyle(.blue)
                                .frame(width: 30, height: 30)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(document.title).font(.headline)
                                Text(documentMetadata(document)).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            }
                            Spacer()
                            if isOpening { ProgressView().controlSize(.small) }
                        }
                        .padding(.vertical, 8)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(document.title)
                        .accessibilityValue(documentMetadata(document))
                        Divider()
                    }
                }
            }.padding()
        }
        .quickLookPreview($previewURL)
        .sheet(isPresented: $isAddingDocument) {
            NavigationStack { AddDocumentView() }
        }
        .alert("Impossibile aprire il documento", isPresented: Binding(
            get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } }
        )) { Button("OK", role: .cancel) {} } message: { Text(errorMessage ?? "") }
        .onDisappear {
            LocalVaultStore().removeMaterializedFile(at: previewURL)
            previewURL = nil
        }
    }

    private func documentMetadata(_ document: HealthDocument) -> String {
        let module = document.linkedModuleId.flatMap { rawValue in
            DocumentModuleLink(rawValue: rawValue)?.title
        }
        return [document.documentType.label, module, document.documentDate]
            .compactMap { $0 }
            .joined(separator: " · ")
    }

    private func documentIcon(_ type: DocumentType) -> String {
        switch type {
        case .bloodTest: "testtube.2"
        case .xray, .mri, .ultrasound: "waveform.path.ecg.rectangle"
        case .prescription: "pills.fill"
        case .photo: "photo.fill"
        default: "doc.text.fill"
        }
    }

    private func open(_ document: HealthDocument) {
        guard let attachment = document.attachment else {
            errorMessage = "Questo record non contiene un file allegato."
            return
        }
        isOpening = true
        Task {
            defer { isOpening = false }
            do {
                LocalVaultStore().removeMaterializedFile(at: previewURL)
                previewURL = try await store.previewURL(for: attachment)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
