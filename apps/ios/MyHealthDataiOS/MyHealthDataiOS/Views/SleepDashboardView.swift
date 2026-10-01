import Charts
import SwiftUI


public struct EnhancedSleepDashboardView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.colorScheme) private var colorScheme
    let onlyFavorites: Bool
    let favoriteMeasurementIDs: Set<String>
    let onToggleMeasurementFavorite: ((MeasurementType) -> Void)?
    @State private var timeWindow = HealthTimeWindow(scale: .week, anchor: .now)
    @State private var showsNewSession = false
    @State private var showsGoal = false

    init(
        onlyFavorites: Bool = false,
        favoriteMeasurementIDs: Set<String> = [],
        onToggleMeasurementFavorite: ((MeasurementType) -> Void)? = nil
    ) {
        self.onlyFavorites = onlyFavorites
        self.favoriteMeasurementIDs = favoriteMeasurementIDs
        self.onToggleMeasurementFavorite = onToggleMeasurementFavorite
    }

    public var body: some View {
        ZStack {
            ExperiencePalette.background(for: colorScheme).ignoresSafeArea()

            MHDDataModuleScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(alignment: .top, spacing: 10) {
                        MHDModuleHeader(title: "Sonno", subtitle: "Durata, fasi e recupero", symbol: "bed.double.fill", tint: ExperiencePalette.sleep)
                        favoriteButton
                    }

                    if onlyFavorites {
                        favoriteContent
                    } else {
                        header
                        CompactHealthTimeNavigator(window: $timeWindow, tint: ExperiencePalette.sleep)

                        if sessions.isEmpty {
                            SleepEmptyState { showsNewSession = true }
                        } else {
                            metrics
                            if !sleepStagePoints.isEmpty { stageSummary }
                            chart
                        }
                    }
                }
                .frame(maxWidth: 880)
                .padding(.horizontal)
                .padding(.top, 8)
                .padding(.bottom, 28)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .tint(ExperiencePalette.sleep)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Impostazioni sonno", systemImage: "gearshape.fill") { showsGoal = true }
            }
        }
        .sheet(isPresented: $showsNewSession) {
            NavigationStack { NewSleepSessionExperienceView() }
        }
        .sheet(isPresented: $showsGoal) {
            NavigationStack { SleepGoalExperienceView() }
        }
    }

    private var isFavorite: Bool {
        favoriteMeasurementIDs.contains("measurement:\(MeasurementType.sleepHours.rawValue)")
    }

    private var favoriteButton: some View {
        Group {
            if let onToggleMeasurementFavorite {
                MHDMetricFavoriteButton(
                    type: .sleepHours,
                    tint: ExperiencePalette.sleep,
                    isFavorite: isFavorite,
                    onToggle: { onToggleMeasurementFavorite(.sleepHours) }
                )
            }
        }
    }

    @ViewBuilder
    private var favoriteContent: some View {
        if !isFavorite {
            ContentUnavailableView(
                "Nessuna metrica del sonno preferita",
                systemImage: "star",
                description: Text("Aggiungi una stella a Durata del sonno per mostrarla qui.")
            )
        } else {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(MeasurementType.sleepHours.label)
                            .font(.headline)
                        Text(sessions.isEmpty ? "Nessun dato" : durationText(minutes: Int((averageHours * 60).rounded())))
                            .font(.system(size: 30, weight: .bold, design: .rounded)).monospacedDigit()
                        Text(sessions.isEmpty ? "Registra una notte per iniziare" : "media per notte registrata")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    favoriteButton
                }
                if !sessions.isEmpty { chart }
            }
            .padding(18)
            .background(ExperiencePalette.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    private var sessions: [SleepSession] {
        let manual = store.sleepSessions.filter { $0.startAt >= timeWindow.start && $0.startAt < timeWindow.end }
        let manualDays = Set(manual.map { Calendar.current.startOfDay(for: $0.startAt) })
        let imported = store.measurements(for: .sleepHours, from: timeWindow.start, to: timeWindow.end)
        let grouped = Dictionary(grouping: imported) { Calendar.current.startOfDay(for: $0.measuredAt) }
        let healthSessions = grouped.compactMap { day, values -> SleepSession? in
            guard !manualDays.contains(day) else { return nil }
            let hours = values.map(\.value).reduce(0, +)
            guard hours > 0 else { return nil }
            let start = values.map(\.measuredAt).min() ?? day
            return SleepSession(
                id: "sleep_health_\(Int(day.timeIntervalSince1970))",
                startAt: start,
                endAt: start.addingTimeInterval(hours * 3600),
                source: .appleHealth
            )
        }
        return (manual + healthSessions).sorted { $0.startAt > $1.startAt }
    }

    private var chronologicalSessions: [SleepSession] {
        sessions.sorted { $0.startAt < $1.startAt }
    }

    private var averageHours: Double {
        guard !sessions.isEmpty else { return 0 }
        return sessions.reduce(0) { $0 + $1.durationHours } / Double(sessions.count)
    }

    private var deficitMinutes: Int {
        sessions.reduce(0) { total, session in
            total + max(store.sleepSettings.goalMinutes - Int((session.durationHours * 60).rounded()), 0)
        }
    }

    private var bedtimeVariationMinutes: Int? {
        guard sessions.count > 1 else { return nil }
        let bedtimes = sessions.map { session -> Double in
            let parts = Calendar.current.dateComponents([.hour, .minute], from: session.startAt)
            let minutes = Double((parts.hour ?? 0) * 60 + (parts.minute ?? 0))
            return minutes < 720 ? minutes + 1440 : minutes
        }
        let mean = bedtimes.reduce(0, +) / Double(bedtimes.count)
        let averageDistance = bedtimes.reduce(0) { $0 + abs($1 - mean) } / Double(bedtimes.count)
        return Int(averageDistance.rounded())
    }

    private var sleepStagePoints: [SleepStagePoint] {
        store.measurements(for: .sleepHours, from: timeWindow.start, to: timeWindow.end).compactMap { measurement in
            guard let marker = measurement.note?.split(separator: "|").first(where: { $0.hasPrefix("sleep_stage=") }) else {
                return nil
            }
            let rawStage = marker.replacingOccurrences(of: "sleep_stage=", with: "")
            return SleepStagePoint(
                date: Calendar.current.startOfDay(for: measurement.measuredAt),
                stage: SleepStage(rawValue: rawStage) ?? .asleep,
                hours: measurement.value
            )
        }
    }

    private var header: some View {
        HStack {
            Label("Obiettivo \(durationText(minutes: store.sleepSettings.goalMinutes))", systemImage: "target")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(ExperiencePalette.sleep)
            Spacer()
            Button { showsNewSession = true } label: {
                Label("Registra", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .frame(minHeight: 42)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
        }
    }

    private var metrics: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
            ExperienceMetricCard(
                title: "Media",
                value: durationText(minutes: Int((averageHours * 60).rounded())),
                detail: "per notte registrata",
                icon: "moon.fill",
                tint: ExperiencePalette.sleep
            )
            ExperienceMetricCard(
                title: "Variazione orario",
                value: bedtimeVariationMinutes.map { "± \($0) min" } ?? "--",
                detail: bedtimeVariationMinutes == nil ? "servono almeno 2 notti" : "media rispetto all'orario abituale",
                icon: "clock.fill",
                tint: .teal
            )
            ExperienceMetricCard(
                title: "Deficit registrato",
                value: durationText(minutes: deficitMinutes),
                detail: deficitMinutes == 0 ? "obiettivo raggiunto" : "rispetto all'obiettivo",
                icon: "chart.bar.fill",
                tint: deficitMinutes == 0 ? .green : .orange
            )
        }
    }

    private var chart: some View {
        ExperienceSection(title: "Durata") {
            Chart {
                if sleepStagePoints.isEmpty {
                    ForEach(chronologicalSessions) { session in
                        BarMark(
                            x: .value("Giorno", session.startAt, unit: .day),
                            y: .value("Ore", session.durationHours)
                        )
                        .foregroundStyle(session.durationHours * 60 >= Double(store.sleepSettings.goalMinutes) ? ExperiencePalette.sleep : Color.orange)
                        .cornerRadius(2)
                    }
                } else {
                    ForEach(sleepStagePoints) { point in
                        BarMark(
                            x: .value("Giorno", point.date, unit: .day),
                            y: .value("Ore", point.hours)
                        )
                        .foregroundStyle(by: .value("Fase", point.stage.label))
                    }
                }
                RuleMark(y: .value("Obiettivo", Double(store.sleepSettings.goalMinutes) / 60))
                    .foregroundStyle(ExperiencePalette.sleep.opacity(0.7))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [5, 4]))
                    .annotation(position: .top, alignment: .trailing) {
                        Text("Obiettivo")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(ExperiencePalette.sleep)
                    }
            }
            .chartForegroundStyleScale([
                SleepStage.core.label: Color.cyan,
                SleepStage.deep.label: Color.indigo,
                SleepStage.rem.label: Color.purple,
                SleepStage.asleep.label: Color.blue
            ])
            .chartYAxis {
                AxisMarks(position: .leading)
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: timeWindow.scale == .week ? 7 : 6)) { value in
                    AxisGridLine().foregroundStyle(.clear)
                    AxisTick()
                    AxisValueLabel(format: timeWindow.scale == .week ? .dateTime.weekday(.narrow) : .dateTime.day().month(.abbreviated))
                }
            }
            .chartYScale(domain: 0...max(10, chronologicalSessions.map(\.durationHours).max() ?? 10))
            .frame(height: 220)
            .padding(14)
            .background(ExperiencePalette.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private var stageSummary: some View {
        let grouped = Dictionary(grouping: sleepStagePoints, by: \.stage)
        return LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 10)], spacing: 10) {
            ForEach([SleepStage.deep, .rem, .core, .asleep], id: \.rawValue) { stage in
                let hours = grouped[stage, default: []].reduce(0) { $0 + $1.hours }
                if hours > 0 {
                    VStack(spacing: 5) {
                        Text(stage.label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        Text(durationText(minutes: Int((hours * 60).rounded())))
                            .font(.headline.monospacedDigit())
                    }
                    .frame(maxWidth: .infinity).padding(12)
                    .mhdGlassCapsule(tint: ExperiencePalette.sleep.opacity(0.06))
                }
            }
        }
    }

    private var recentSessions: some View {
        ExperienceSection(title: "Notti recenti") {
            VStack(spacing: 10) {
                ForEach(sessions.prefix(8)) { session in
                    SleepSessionExperienceRow(session: session)
                }
            }
        }
    }

    private func durationText(minutes: Int) -> String {
        let safeMinutes = max(minutes, 0)
        let hours = safeMinutes / 60
        let remainder = safeMinutes % 60
        if hours == 0 { return "\(remainder) min" }
        if remainder == 0 { return "\(hours) h" }
        return "\(hours) h \(remainder) min"
    }
}
