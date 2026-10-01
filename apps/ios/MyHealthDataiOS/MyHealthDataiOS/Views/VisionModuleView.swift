import SwiftUI

// MARK: - Vision

struct VisionModuleView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var editing: HealthEvent?
    @State private var isAdding = false
    @State private var isAddingIssue = false
    @State private var isAddingDocument = false
    private var prescriptions: [HealthEvent] { store.events.filter { $0.type == .visionPrescription && $0.tag("record") != "issue" } }
    private var issues: [HealthEvent] { store.events.filter { $0.type == .visionPrescription && $0.tag("record") == "issue" } }

    var body: some View {
        MHDDataModuleScrollView {
            VStack(alignment: .leading, spacing: 20) {
                MHDModuleHeader(title: "Vista", subtitle: "Occhi, prescrizioni e problematiche", symbol: "eyeglasses", tint: .blue)
                HStack {
                    Spacer()
                    Menu {
                        Button("Nuova prescrizione", systemImage: "eyeglasses") { isAdding = true }
                        Button("Problema oculare", systemImage: "eye.trianglebadge.exclamationmark") { isAddingIssue = true }
                        Button("Aggiungi documento", systemImage: "doc.badge.plus") { isAddingDocument = true }
                    } label: { Label("Aggiungi", systemImage: "plus") }.mhdGlassButton(prominent: true)
                }
                visionHero
                if !issues.isEmpty {
                    SpecialtySection("Salute degli occhi") {
                        ForEach(issues) { issue in
                            HStack(spacing: 12) {
                                Image(systemName: "eye.trianglebadge.exclamationmark").foregroundStyle(.orange)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(issue.description).font(.headline)
                                    Text([issue.tag("eye"), issue.tag("status")].compactMap { $0 }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button("Elimina", systemImage: "trash", role: .destructive) { store.deleteEvent(id: issue.id) }.labelStyle(.iconOnly)
                            }.padding(14).mhdGlassPanel(tint: Color.orange.opacity(0.05))
                        }
                    }
                }
                SpecialtySection("Storico prescrizioni") {
                    if prescriptions.isEmpty { ContentUnavailableView("Nessuna prescrizione", systemImage: "eyeglasses", description: Text("Registra i valori di ciascun occhio e confrontali nel tempo.")).frame(minHeight: 280) }
                    ForEach(prescriptions) { item in
                        Button { editing = item } label: { prescriptionRow(item) }.buttonStyle(.plain)
                            .contextMenu { Button("Elimina", role: .destructive) { store.deleteEvent(id: item.id) } }
                    }
                }
                SpecialtySection("Documenti") {
                    Label(
                        "I documenti collegati sono disponibili nel tab Documenti.",
                        systemImage: "folder"
                    )
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
            }.padding()
        }
            .sheet(isPresented: $isAdding) { NavigationStack { VisionPrescriptionEditor() } }
            .sheet(isPresented: $isAddingIssue) { NavigationStack { VisionIssueEditor() } }
            .sheet(isPresented: $isAddingDocument) {
                NavigationStack {
                    AddDocumentView(
                        initialType: .specialistVisit,
                        initialTitle: "Visita oculistica",
                        linkedModuleId: DocumentModuleLink.vision.rawValue
                    )
                }
            }
            .sheet(item: $editing) { record in NavigationStack { VisionPrescriptionEditor(event: record) } }
    }

    private var visionHero: some View {
        VStack(spacing: 16) {
            Text("Correzione attuale").font(.headline)
            HStack(spacing: 24) {
                eyeVisual("OD", prefix: "r")
                eyeVisual("OS", prefix: "l")
            }
            if prescriptions.isEmpty { Text("Aggiungi una prescrizione per vedere la correzione dei due occhi.").font(.caption).foregroundStyle(.secondary) }
        }.padding(20).frame(maxWidth: .infinity).mhdGlassPanel(tint: Color.blue.opacity(0.07))
    }
    private func eyeVisual(_ eye: String, prefix: String) -> some View {
        let latest = prescriptions.first
        return VStack(spacing: 7) {
            ZStack {
                Ellipse().fill(Color.blue.opacity(0.10)).frame(width: 112, height: 72)
                Ellipse().stroke(Color.blue.opacity(0.35), lineWidth: 2).frame(width: 112, height: 72)
                Circle().fill(Color.blue.gradient).frame(width: 44, height: 44)
                Circle().fill(.black).frame(width: 17, height: 17)
                Circle().fill(.white.opacity(0.8)).frame(width: 6, height: 6).offset(x: -5, y: -6)
            }
            Text(eye).font(.caption.bold()).foregroundStyle(.blue)
            Text(latest?.tag("\(prefix)s")?.isEmpty == false ? "\(latest?.tag("\(prefix)s") ?? "—") D" : "—")
                .font(.title3.bold().monospacedDigit())
            Text("Cil. \(latest?.tag("\(prefix)c") ?? "—") · \(latest?.tag("\(prefix)a") ?? "—")°")
                .font(.caption2).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity)
    }
    private func prescriptionRow(_ item: HealthEvent) -> some View { HStack { Image(systemName: "eyeglasses").foregroundStyle(.blue); VStack(alignment: .leading) { Text(item.occurredAt.formatted(date: .long, time: .omitted)).font(.headline); Text(item.tag("kind") ?? "Occhiali").font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "chevron.right").foregroundStyle(.tertiary) }.padding(15).mhdGlassPanel(tint: Color.blue.opacity(0.04)) }
}

private struct VisionIssueEditor: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var issue = "Occhio secco"
    @State private var eye = "Entrambi"
    @State private var status = "In corso"
    @State private var date = Date.now
    @State private var note = ""
    private let issues = ["Occhio secco", "Sensibilità alla luce", "Visione offuscata", "Infezione", "Lesione", "Ustione chimica", "Glaucoma", "Cataratta", "Intervento", "Altro"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Problema oculare").font(.title3.bold())
                    Picker("Problema", selection: $issue) { ForEach(issues, id: \.self) { Text($0) } }
                    Picker("Occhio", selection: $eye) { ForEach(["Destro · OD", "Sinistro · OS", "Entrambi"], id: \.self) { Text($0) } }.pickerStyle(.segmented)
                    Picker("Stato", selection: $status) { ForEach(["In corso", "Risolto", "Da controllare"], id: \.self) { Text($0) } }
                    DatePicker("Data", selection: $date, in: ...Date.now, displayedComponents: .date)
                    TextField("Sintomi, trattamento o indicazioni", text: $note, axis: .vertical).lineLimit(2...6).specialtyInput()
                }.padding(18).mhdGlassPanel(tint: Color.blue.opacity(0.05))
                Button("Salva problema") {
                    store.saveEvent(HealthEvent(type: .visionPrescription, occurredAt: date, description: issue, tags: ["record=issue", "eye=\(eye)", "status=\(status)", "note=\(note)"]))
                    dismiss()
                }.frame(maxWidth: .infinity).mhdGlassButton(prominent: true)
            }.padding(20)
        }.navigationTitle("Salute dell'occhio").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } } }
    }
}

private struct VisionPrescriptionEditor: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let event: HealthEvent?
    @State private var date = Date.now; @State private var kind = "Occhiali"; @State private var rs = ""; @State private var rc = ""; @State private var ra = ""; @State private var ls = ""; @State private var lc = ""; @State private var la = ""; @State private var add = ""; @State private var pd = ""; @State private var professional = ""
    init(event: HealthEvent? = nil) { self.event = event }
    var body: some View { ScrollView { VStack(alignment: .leading, spacing: 16) {
        panel("Prescrizione") { DatePicker("Data", selection: $date, in: ...Date.now, displayedComponents: .date); Picker("Uso", selection: $kind) { ForEach(["Occhiali", "Lenti a contatto", "Lettura", "Progressive"], id: \.self) { Text($0) } }; TextField("Ottico o oculista", text: $professional).specialtyInput() }
        HStack(alignment: .top, spacing: 12) { eyePanel("Occhio destro · OD", sphere: $rs, cylinder: $rc, axis: $ra); eyePanel("Occhio sinistro · OS", sphere: $ls, cylinder: $lc, axis: $la) }
        panel("Valori comuni") { TextField("ADD", text: $add).specialtyInput(); TextField("Distanza pupillare · mm", text: $pd).specialtyInput() }
        Button("Salva prescrizione", action: save).frame(maxWidth: .infinity).mhdGlassButton(prominent: true)
        if let event { Button("Elimina prescrizione", role: .destructive) { store.deleteEvent(id: event.id); dismiss() }.frame(maxWidth: .infinity) }
    }.padding(20) }.navigationTitle(event == nil ? "Nuova prescrizione" : "Modifica prescrizione").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } } }.onAppear(perform: load) }
    private func panel<C: View>(_ title: String, @ViewBuilder content: () -> C) -> some View { VStack(alignment: .leading, spacing: 12) { Text(title).font(.title3.bold()); content() }.padding(18).mhdGlassPanel(tint: Color.blue.opacity(0.05)) }
    private func eyePanel(_ title: String, sphere: Binding<String>, cylinder: Binding<String>, axis: Binding<String>) -> some View { VStack(alignment: .leading, spacing: 10) { Text(title).font(.headline); TextField("Sfera", text: sphere).specialtyInput(); TextField("Cilindro", text: cylinder).specialtyInput(); TextField("Asse 0–180°", text: axis).specialtyInput() }.padding(15).frame(maxWidth: .infinity).mhdGlassPanel(tint: Color.blue.opacity(0.04)) }
    private func load() { guard let e = event else { return }; date=e.occurredAt; kind=e.tag("kind") ?? kind; rs=e.tag("rs") ?? ""; rc=e.tag("rc") ?? ""; ra=e.tag("ra") ?? ""; ls=e.tag("ls") ?? ""; lc=e.tag("lc") ?? ""; la=e.tag("la") ?? ""; add=e.tag("add") ?? ""; pd=e.tag("pd") ?? ""; professional=e.description }
    private func save() { var e = event ?? HealthEvent(type: .visionPrescription, occurredAt: date, description: professional.isEmpty ? kind : professional); e.occurredAt=date; e.description=professional.isEmpty ? kind : professional; e.tags=["kind=\(kind)","rs=\(rs)","rc=\(rc)","ra=\(ra)","ls=\(ls)","lc=\(lc)","la=\(la)","add=\(add)","pd=\(pd)"]; e.updatedAt = .now; store.saveEvent(e); dismiss() }
}

// MARK: - Gut health
