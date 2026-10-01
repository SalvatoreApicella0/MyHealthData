import SwiftUI

// MARK: - Allergies

struct AllergiesModuleView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var editing: HealthEvent?
    @State private var isAdding = false
    private let tint = Color.orange

    private var records: [HealthEvent] {
        store.events.filter { $0.type == .allergy }
    }

    var body: some View {
        MHDDataModuleScrollView {
            VStack(alignment: .leading, spacing: 20) {
                MHDModuleHeader(title: "Allergie", subtitle: records.isEmpty ? "Crea il tuo profilo allergico" : "\(records.count) allergeni registrati", symbol: "allergens.fill", tint: tint)

                if records.contains(where: { $0.tag("severity") == "Anafilassi" }) {
                    Label("Piano di emergenza: porta con te l'adrenalina prescritta e segui le indicazioni del medico.", systemImage: "cross.case.fill")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(.red)
                        .padding(16).mhdGlassPanel(tint: Color.red.opacity(0.08))
                }

                SpecialtySection("I tuoi allergeni") {
                    if records.isEmpty {
                        ContentUnavailableView("Nessuna allergia registrata", systemImage: "allergens", description: Text("Aggiungi allergie alimentari, farmaci, pollini, animali, lattice o punture."))
                            .frame(minHeight: 260)
                    } else {
                        ForEach(records) { record in
                            Button { editing = record } label: { allergyCard(record) }.buttonStyle(.plain)
                                .contextMenu { Button("Elimina", role: .destructive) { store.deleteEvent(id: record.id) } }
                        }
                    }
                }
            }.padding()
        }
        .overlay(alignment: .bottomTrailing) {
            Button { isAdding = true } label: { Image(systemName: "plus").font(.title3.bold()).frame(width: 54, height: 54) }
                .mhdGlassCircle(tint: tint, interactive: true).padding(22)
                .accessibilityLabel("Aggiungi allergia")
        }
        .sheet(isPresented: $isAdding) { NavigationStack { AllergyEditorView() } }
        .sheet(item: $editing) { record in NavigationStack { AllergyEditorView(event: record) } }
    }

    private func allergyCard(_ record: HealthEvent) -> some View {
        HStack(spacing: 14) {
            Image(systemName: allergyIcon(record.tag("category"))).font(.title2).foregroundStyle(tint)
                .frame(width: 46, height: 46).mhdGlassCircle(tint: tint.opacity(0.1))
            VStack(alignment: .leading, spacing: 4) {
                Text(record.description).font(.headline)
                Text([record.tag("category"), record.tag("severity")].compactMap { $0 }.joined(separator: " · "))
                    .font(.subheadline).foregroundStyle(.secondary)
                if let symptoms = record.tag("symptoms"), !symptoms.isEmpty { Text(symptoms).font(.caption).lineLimit(2) }
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
        }.padding(15).mhdGlassPanel(tint: tint.opacity(0.05))
    }

    private func allergyIcon(_ category: String?) -> String {
        switch category { case "Alimento": "fork.knife"; case "Farmaco": "pills.fill"; case "Polline": "leaf.fill"; case "Puntura": "ant.fill"; default: "allergens.fill" }
    }
}

private struct AllergyEditorView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let event: HealthEvent?
    @State private var name = ""
    @State private var category = "Alimento"
    @State private var severity = "Moderata"
    @State private var symptoms = ""
    @State private var treatment = ""
    @State private var confirmed = false
    @State private var carriesEpinephrine = false
    @State private var date = Date.now
    @State private var showsDetails = false
    private let categories = ["Alimento", "Farmaco", "Polline", "Animale", "Lattice", "Puntura", "Contatto", "Altro"]
    private let severities = ["Lieve", "Moderata", "Grave", "Anafilassi"]

    init(event: HealthEvent? = nil) { self.event = event }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                editorPanel("Allergene") {
                    TextField("Nome dell'allergene", text: $name).specialtyInput()
                    Picker("Categoria", selection: $category) { ForEach(categories, id: \.self) { Text($0) } }
                    Picker("Reazione più grave", selection: $severity) { ForEach(severities, id: \.self) { Text($0) } }
                    DatePicker("Ultima reazione o diagnosi", selection: $date, in: ...Date.now, displayedComponents: .date)
                }
                DisclosureGroup("Sintomi, terapia e sicurezza", isExpanded: $showsDetails) {
                    VStack(spacing: 14) {
                editorPanel("Manifestazioni") {
                    TextField("Sintomi osservati", text: $symptoms, axis: .vertical).lineLimit(2...5).specialtyInput()
                    TextField("Terapia o istruzioni", text: $treatment, axis: .vertical).lineLimit(2...5).specialtyInput()
                }
                editorPanel("Sicurezza") {
                    Toggle("Confermata da un professionista", isOn: $confirmed)
                    Toggle("Porto adrenalina prescritta", isOn: $carriesEpinephrine)
                }
                    }.padding(.top, 12)
                }
                .font(.headline)
                .padding(16)
                .mhdGlassPanel(tint: Color.orange.opacity(0.04))
                Button("Salva allergia", action: save).disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                    .frame(maxWidth: .infinity).mhdGlassButton(prominent: true)
                if let event {
                    Button("Elimina allergia", role: .destructive) { store.deleteEvent(id: event.id); dismiss() }
                        .frame(maxWidth: .infinity)
                }
            }.padding(20)
        }.navigationTitle(event == nil ? "Nuova allergia" : "Modifica allergia").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } } }
            .onAppear(perform: load)
    }

    private func editorPanel<C: View>(_ title: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) { Text(title).font(.title3.bold()); content() }
            .padding(18).mhdGlassPanel(tint: Color.orange.opacity(0.05))
    }
    private func load() { guard let event else { return }; name = event.description; category = event.tag("category") ?? category; severity = event.tag("severity") ?? severity; symptoms = event.tag("symptoms") ?? ""; treatment = event.tag("treatment") ?? ""; confirmed = event.tags.contains("confirmed"); carriesEpinephrine = event.tags.contains("epinephrine"); date = event.occurredAt }
    private func save() { var value = event ?? HealthEvent(type: .allergy, occurredAt: date, description: name); value.description = name.trimmingCharacters(in: .whitespaces); value.occurredAt = date; value.tags = ["category=\(category)", "severity=\(severity)", "symptoms=\(symptoms)", "treatment=\(treatment)"] + (confirmed ? ["confirmed"] : []) + (carriesEpinephrine ? ["epinephrine"] : []); value.updatedAt = .now; store.saveEvent(value); dismiss() }
}
