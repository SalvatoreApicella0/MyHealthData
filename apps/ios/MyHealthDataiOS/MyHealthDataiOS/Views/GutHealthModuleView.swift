import SwiftUI

struct GutHealthModuleView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var editing: HealthEvent?; @State private var isAdding = false
    private var entries: [HealthEvent] { store.events.filter { $0.type == .digestiveHealth } }
    var body: some View { MHDDataModuleScrollView { VStack(alignment: .leading, spacing: 20) {
        MHDModuleHeader(title: "Salute intestinale", subtitle: "Sintomi, regolarità e benessere", symbol: "fork.knife.circle.fill", tint: .green)
        HStack(spacing: 12) { quickStat("Oggi", value: "\(entries.filter { Calendar.current.isDateInToday($0.occurredAt) }.count)", icon: "calendar"); quickStat("Ultimo Bristol", value: entries.first?.tag("bristol") ?? "—", icon: "chart.bar.fill") }
        SpecialtySection("Diario") { if entries.isEmpty { ContentUnavailableView("Nessuna registrazione", systemImage: "stomach", description: Text("Registra dolore, gonfiore, reflusso, nausea o evacuazioni.")).frame(minHeight: 280) }; ForEach(entries) { e in Button { editing=e } label: { HStack { Image(systemName: e.tag("kind") == "Evacuazione" ? "drop.circle.fill" : "waveform.path.ecg").foregroundStyle(.green); VStack(alignment: .leading) { Text(e.tag("kind") ?? "Sintomo").font(.headline); Text(e.description).font(.subheadline).foregroundStyle(.secondary).lineLimit(2) }; Spacer(); Text(e.occurredAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary) }.padding(15).mhdGlassPanel(tint: Color.green.opacity(0.04)) }.buttonStyle(.plain).contextMenu { Button("Elimina", role: .destructive) { store.deleteEvent(id:e.id) } } } }
    }.padding() }
        .overlay(alignment: .bottomTrailing) { Button { isAdding = true } label: { Image(systemName: "plus").font(.title3.bold()).frame(width: 54, height: 54) }.mhdGlassCircle(tint: .green, interactive: true).padding(22).accessibilityLabel("Registra sintomo o evacuazione") }
        .sheet(isPresented:$isAdding) { NavigationStack { GutEntryEditor() } }.sheet(item:$editing) { record in NavigationStack { GutEntryEditor(event:record) } } }
    private func quickStat(_ title:String,value:String,icon:String)->some View { VStack(alignment:.leading,spacing:5){Label(title,systemImage:icon).font(.caption).foregroundStyle(.green);Text(value).font(.title.bold())}.padding(16).frame(maxWidth:.infinity,alignment:.leading).mhdGlassPanel(tint:Color.green.opacity(0.05)) }
}

private struct GutEntryEditor: View {
    @Environment(HealthDataStore.self) private var store; @Environment(\.dismiss) private var dismiss; let event:HealthEvent?
    @State private var kind="Sintomo"; @State private var symptom="Mal di pancia"; @State private var intensity=5; @State private var bristol=4; @State private var trigger=""; @State private var note=""; @State private var date=Date.now
    init(event:HealthEvent?=nil){self.event=event}
    var body:some View { ScrollView { VStack(alignment:.leading,spacing:16){
        Picker("Tipo",selection:$kind){Text("Sintomo").tag("Sintomo");Text("Evacuazione").tag("Evacuazione")}.pickerStyle(.segmented)
        VStack(alignment:.leading,spacing:12){DatePicker("Quando",selection:$date,in:...Date.now);if kind=="Sintomo"{Picker("Sintomo",selection:$symptom){ForEach(["Mal di pancia","Gonfiore","Reflusso","Nausea","Crampi","Diarrea","Stitichezza","Altro"],id:\.self){Text($0)}};Stepper("Intensità \(intensity)/10",value:$intensity,in:1...10)}else{Stepper("Scala Bristol · tipo \(bristol)",value:$bristol,in:1...7);Text("1–2 duro · 3–4 formato · 5–7 morbido/liquido").font(.caption).foregroundStyle(.secondary)};TextField("Possibile alimento o trigger",text:$trigger).specialtyInput();TextField("Nota",text:$note,axis:.vertical).lineLimit(2...5).specialtyInput()}.padding(18).mhdGlassPanel(tint:Color.green.opacity(0.05))
        Button("Salva",action:save).frame(maxWidth:.infinity).mhdGlassButton(prominent:true);if let event{Button("Elimina",role:.destructive){store.deleteEvent(id:event.id);dismiss()}.frame(maxWidth:.infinity)}
    }.padding(20)}.navigationTitle(kind).navigationBarTitleDisplayMode(.inline).toolbar{ToolbarItem(placement:.cancellationAction){Button("Annulla"){dismiss()}}}.onAppear(perform:load)}
    private func load(){guard let e=event else{return};kind=e.tag("kind") ?? kind;symptom=e.tag("symptom") ?? symptom;intensity=Int(e.tag("intensity") ?? "5") ?? 5;bristol=Int(e.tag("bristol") ?? "4") ?? 4;trigger=e.tag("trigger") ?? "";note=e.description;date=e.occurredAt}
    private func save(){let summary=kind=="Sintomo" ? "\(symptom) · \(intensity)/10\(note.isEmpty ? "" : " · \(note)")" : "Tipo \(bristol)\(note.isEmpty ? "" : " · \(note)")";var e=event ?? HealthEvent(type:.digestiveHealth,occurredAt:date,description:summary);e.occurredAt=date;e.description=summary;e.tags=["kind=\(kind)","symptom=\(symptom)","intensity=\(intensity)","bristol=\(bristol)","trigger=\(trigger)"];e.updatedAt = .now;store.saveEvent(e);dismiss()}
}

// MARK: - Dental
