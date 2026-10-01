import SwiftUI


struct SleepGoalExperienceView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var goalMinutes = 480

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                ZStack {
                    Circle()
                        .stroke(ExperiencePalette.sleep.opacity(0.14), lineWidth: 18)
                    Circle()
                        .trim(from: 0, to: min(Double(goalMinutes) / 720, 1))
                        .stroke(ExperiencePalette.sleep, style: StrokeStyle(lineWidth: 18, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 4) {
                        Image(systemName: "moon.stars.fill")
                            .foregroundStyle(ExperiencePalette.sleep)
                        Text(durationText)
                            .font(.title.bold().monospacedDigit())
                        Text("ogni notte")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 210, height: 210)

                VStack(spacing: 14) {
                    Slider(value: Binding(
                        get: { Double(goalMinutes) },
                        set: { goalMinutes = Int($0.rounded() / 15) * 15 }
                    ), in: 180...720, step: 15)
                    HStack {
                        Text("3 ore")
                        Spacer()
                        Text("12 ore")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                .padding(18)
                .mhdGlassPanel(tint: ExperiencePalette.sleep.opacity(0.06))

                Button("Salva obiettivo") {
                    store.saveSleepSettings(SleepSettings(goalMinutes: goalMinutes))
                    dismiss()
                }
                .frame(maxWidth: .infinity)
                .mhdGlassButton(prominent: true)
            }
            .padding(22)
        }
        .navigationTitle("Obiettivo sonno")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Annulla") { dismiss() }
            }
        }
        .onAppear { goalMinutes = store.sleepSettings.goalMinutes }
    }

    private var durationText: String {
        let hours = goalMinutes / 60
        let minutes = goalMinutes % 60
        return minutes == 0 ? "\(hours) ore" : "\(hours) ore \(minutes) min"
    }
}

struct NewSleepSessionExperienceView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var night = Date.now
    @State private var bedtime = Calendar.current.date(bySettingHour: 23, minute: 0, second: 0, of: .now) ?? .now
    @State private var wakeTime = Calendar.current.date(bySettingHour: 7, minute: 0, second: 0, of: .now) ?? .now

    var body: some View {
        VStack(spacing: 22) {
            DatePicker("Notte del", selection: $night, in: ...Date.now, displayedComponents: .date)
                .datePickerStyle(.compact)
            HStack(spacing: 12) {
                timeCard("A letto", icon: "moon.fill", selection: $bedtime)
                timeCard("Sveglia", icon: "sun.max.fill", selection: $wakeTime)
            }
            VStack(spacing: 4) {
                Text("Durata").font(.caption).foregroundStyle(.secondary)
                Text(durationText).font(.largeTitle.bold().monospacedDigit()).foregroundStyle(ExperiencePalette.sleep)
            }
            Spacer()
            Button("Salva notte", action: save)
                .frame(maxWidth: .infinity).mhdGlassButton(prominent: true)
        }
        .padding(22)
        .navigationTitle("Nuova notte")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Annulla") { dismiss() }
            }
        }
    }

    private var durationText: String {
        let (startAt, endAt) = resolvedDates
        let minutes = max(Int(endAt.timeIntervalSince(startAt) / 60), 0)
        return "\(minutes / 60) h \(minutes % 60) min"
    }

    private var resolvedDates: (Date, Date) {
        let calendar = Calendar.current
        let nightStart = calendar.startOfDay(for: night)
        let bed = calendar.dateComponents([.hour, .minute], from: bedtime)
        let wake = calendar.dateComponents([.hour, .minute], from: wakeTime)
        let start = calendar.date(bySettingHour: bed.hour ?? 23, minute: bed.minute ?? 0, second: 0, of: nightStart) ?? nightStart
        var end = calendar.date(bySettingHour: wake.hour ?? 7, minute: wake.minute ?? 0, second: 0, of: nightStart) ?? nightStart
        if end <= start { end = calendar.date(byAdding: .day, value: 1, to: end) ?? end }
        return (start, end)
    }

    private func timeCard(_ title: String, icon: String, selection: Binding<Date>) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon).font(.title2).foregroundStyle(ExperiencePalette.sleep)
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            DatePicker(title, selection: selection, displayedComponents: .hourAndMinute)
                .labelsHidden().datePickerStyle(.compact)
        }
        .frame(maxWidth: .infinity).padding(18)
        .mhdGlassPanel(tint: ExperiencePalette.sleep.opacity(0.06))
    }

    private func save() {
        let (startAt, endAt) = resolvedDates
        store.addSleepSession(
            SleepSession(
                startAt: startAt,
                endAt: endAt
            )
        )
        dismiss()
    }
}
