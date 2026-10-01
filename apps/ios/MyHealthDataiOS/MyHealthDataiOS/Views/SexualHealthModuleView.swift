import Charts
import SwiftUI

struct SexualHealthModuleView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var isAdding = false
    @State private var window = HealthTimeWindow(scale: .month, anchor: .now)

    private var events: [HealthEvent] {
        store.events.filter { ($0.type == .sexualActivity || $0.type == .masturbation) && $0.occurredAt >= window.start && $0.occurredAt < window.end }
    }

    var body: some View {
        MHDDataModuleScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                MHDModuleHeader(title: "Salute sessuale", subtitle: "Attività, protezione e controlli", symbol: "heart.circle.fill", tint: .pink)
                CompactHealthTimeNavigator(window: $window, tint: .pink)
                HStack(spacing: 10) {
                    summary("Rapporti", value: events.filter { $0.type == .sexualActivity }.count)
                    summary("Masturbazione", value: events.filter { $0.type == .masturbation }.count)
                    summary("Protetti", value: events.filter { $0.tags.contains("protected") }.count)
                }
                Button { isAdding = true } label: {
                    Label("Registra attività", systemImage: "plus").font(.headline).frame(maxWidth: .infinity, minHeight: 50)
                }.mhdGlassButton(prominent: true).tint(.pink)
                if events.isEmpty {
                    ContentUnavailableView("Nessuna attività registrata", systemImage: "heart.circle", description: Text("Questa sezione è facoltativa e resta nel vault locale cifrato."))
                } else {
                    Chart(events) { event in
                        BarMark(x: .value("Giorno", Calendar.current.startOfDay(for: event.occurredAt)), y: .value("Attività", 1))
                            .foregroundStyle(by: .value("Tipo", event.type.label))
                    }.frame(height: 190)
                    ForEach(events) { event in
                        HStack(spacing: 12) {
                            Image(systemName: event.type == .sexualActivity ? "heart.fill" : "hand.raised.fill").foregroundStyle(.pink)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(event.type.label).font(.headline)
                                Text(event.occurredAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary)
                                if let partner = event.tags.first(where: { $0.hasPrefix("partner:") })?.dropFirst(8), !partner.isEmpty {
                                    Text("Partner: \(partner)").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if event.tags.contains("protected") { Label("Protetto", systemImage: "shield.fill").font(.caption).foregroundStyle(.green).labelStyle(.iconOnly) }
                            Menu {
                                Button("Elimina registrazione", systemImage: "trash", role: .destructive) {
                                    store.deleteEvent(id: event.id)
                                }
                            } label: {
                                Image(systemName: "ellipsis.circle").frame(width: 32, height: 32)
                            }
                            .menuStyle(.borderlessButton)
                        }.padding(14).mhdGlassPanel(tint: Color.pink.opacity(0.04))
                    }
                }
                Text("I dati sui partner servono solo come alias locali per riconoscere continuità e contesto. Non vengono usati per stimare o diagnosticare infezioni sessualmente trasmissibili.")
                    .font(.caption).foregroundStyle(.secondary).padding(14).mhdGlassPanel()
            }.padding()
        }
        .sheet(isPresented: $isAdding) { NavigationStack { SexualActivityEntryView() } }
    }

    private func summary(_ title: String, value: Int) -> some View {
        VStack(spacing: 4) { Text("\(value)").font(.title2.bold()); Text(title).font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7) }
            .frame(maxWidth: .infinity).padding(12).mhdGlassPanel(tint: Color.pink.opacity(0.04))
    }
}

private struct SexualActivityEntryView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var type = EventType.sexualActivity
    @State private var date = Date.now
    @State private var partnerAlias = ""
    @State private var protected = false
    @State private var contraception = false
    @State private var note = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Attività").font(.title3.bold())
                Picker("Tipo", selection: $type) {
                    Text("Con partner").tag(EventType.sexualActivity)
                    Text("Masturbazione").tag(EventType.masturbation)
                }.pickerStyle(.segmented)
                DatePicker("Quando", selection: $date, in: ...Date.now)
                }
                .padding(18)
                .mhdGlassPanel(tint: Color.pink.opacity(0.06))

                if type == .sexualActivity {
                    VStack(alignment: .leading, spacing: 14) {
                    Text("Contesto facoltativo").font(.title3.bold())
                    TextField("Alias del partner", text: $partnerAlias)
                        .textFieldStyle(.roundedBorder)
                    Toggle("Protezione barriera", isOn: $protected)
                    Toggle("Contraccezione", isOn: $contraception)
                    }
                    .padding(18)
                    .mhdGlassPanel(tint: Color.pink.opacity(0.04))
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Nota facoltativa").font(.title3.bold())
                    TextField("Sintomi, benessere o contesto", text: $note, axis: .vertical)
                        .lineLimit(2...5)
                        .textFieldStyle(.roundedBorder)
                }
                .padding(18)
                .mhdGlassPanel(tint: Color.pink.opacity(0.04))

                Button("Salva attività") { save() }
                    .frame(maxWidth: .infinity)
                    .mhdGlassButton(prominent: true)
            }
            .padding(20)
        }
        .navigationTitle("Registra attività")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
        }
    }

    private func save() {
        var tags: [String] = []
        if protected { tags.append("protected") }
        if contraception { tags.append("contraception") }
        if let alias = partnerAlias.nilIfBlank { tags.append("partner:\(alias)") }
        store.addEvent(HealthEvent(type: type, occurredAt: date, description: note.nilIfBlank ?? type.label, tags: tags))
        dismiss()
    }
}
