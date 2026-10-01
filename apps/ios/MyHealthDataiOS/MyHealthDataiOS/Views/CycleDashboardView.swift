import SwiftUI

enum CyclePalette {
    static let rose = Color(red: 0.86, green: 0.20, blue: 0.36)
    static let coral = Color(red: 0.96, green: 0.38, blue: 0.42)
    static let fertile = Color(red: 0.08, green: 0.58, blue: 0.56)
    static let ovulation = Color(red: 0.48, green: 0.30, blue: 0.63)

    static func background(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark
            ? Color(red: 0.10, green: 0.07, blue: 0.09)
            : Color(red: 0.99, green: 0.96, blue: 0.97)
    }

    static func surface(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark
            ? Color(red: 0.16, green: 0.11, blue: 0.14)
            : .white
    }

    static func secondarySurface(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark
            ? Color(red: 0.20, green: 0.14, blue: 0.17)
            : Color(red: 1.00, green: 0.92, blue: 0.94)
    }
}

enum CycleDateText {
    static let locale = Locale(identifier: "it_IT")

    static func full(_ date: Date) -> String {
        capitalized(date.formatted(
            .dateTime.weekday(.wide).day().month(.wide).locale(locale)
        ))
    }

    static func monthYear(_ date: Date) -> String {
        capitalized(date.formatted(.dateTime.month(.wide).year().locale(locale)))
    }

    static func short(_ date: Date) -> String {
        date.formatted(.dateTime.day().month(.abbreviated).locale(locale))
    }

    static func range(_ range: CycleDateRange) -> String {
        "\(short(range.start)) - \(short(range.end))"
    }

    private static func capitalized(_ value: String) -> String {
        guard let first = value.first else { return value }
        return String(first).uppercased(with: locale) + value.dropFirst()
    }
}

private enum CycleDashboardSection: String, CaseIterable, Identifiable {
    case today = "Oggi"
    case history = "Storico"

    var id: String { rawValue }
}

private struct CycleLogTarget: Identifiable {
    let id = UUID()
    var date: Date
    var preset: CycleLogPreset = .none
}

struct CycleDashboardView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedSection: CycleDashboardSection = .today
    @State private var logTarget: CycleLogTarget?
    @State private var showsSettings = false
    @State private var showsSetup = false
    @State private var showsPredictionInfo = false
    @State private var checkedSetup = false

    private var forecast: CycleForecast? {
        CyclePredictor.forecast(entries: store.cycleEntries, settings: store.cycleSettings)
    }

    var body: some View {
        ZStack {
            CyclePalette.background(for: colorScheme)
                .ignoresSafeArea()

            MHDDataModuleScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    MHDModuleHeader(title: "Ciclo mestruale", subtitle: "Flusso, sintomi e diario", symbol: "calendar.circle.fill", tint: CyclePalette.rose)
                    header
                    sectionPicker

                    switch selectedSection {
                    case .today:
                        todayContent
                    case .history:
                        CycleHistoryView(forecast: forecast, settings: store.cycleSettings) {
                            logTarget = CycleLogTarget(date: $0)
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
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    showsPredictionInfo = true
                } label: {
                    Image(systemName: "info.circle")
                }
                .accessibilityLabel("Informazioni sulle stime")

                Button {
                    showsSettings = true
                } label: {
                    Image(systemName: "slider.horizontal.3")
                }
                .accessibilityLabel("Impostazioni ciclo")
            }
        }
        .tint(CyclePalette.rose)
        .sheet(item: $logTarget) { target in
            CycleLogView(date: target.date, preset: target.preset)
        }
        .sheet(isPresented: $showsSettings) {
            CycleSettingsView()
        }
        .sheet(isPresented: $showsPredictionInfo) {
            CyclePredictionInfoView()
        }
        .sheet(isPresented: $showsSetup) {
            CycleSetupView()
                .interactiveDismissDisabled()
        }
        .onAppear(perform: checkSetup)
        .onChange(of: store.isLoaded) { _, _ in checkSetup() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(CycleDateText.full(.now)).font(.subheadline).foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Button {
                    logTarget = CycleLogTarget(date: .now, preset: .startPeriod)
                } label: {
                    Label("Segna inizio", systemImage: "calendar.badge.plus")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14)
                        .frame(minHeight: 42)
                }
                .mhdGlassButton(prominent: true)

                Button {
                    logTarget = CycleLogTarget(date: .now, preset: .flow)
                } label: {
                    Label("Segna flusso", systemImage: "drop.fill")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14)
                        .frame(minHeight: 42)
                }
                .mhdGlassButton()
                Spacer()
            }
        }
    }

    private var sectionPicker: some View {
        Picker("Vista", selection: $selectedSection) {
            ForEach(CycleDashboardSection.allCases) { section in
                Text(section.rawValue).tag(section)
            }
        }
        .pickerStyle(.segmented)
        .accessibilityLabel("Vista ciclo")
    }

    @ViewBuilder
    private var todayContent: some View {
        if let forecast {
            CycleHeroView(forecast: forecast, settings: store.cycleSettings)

            CycleKPIRow(forecast: forecast, settings: store.cycleSettings)

            CyclePhaseExplanation(phase: forecast.phase(on: .now))

            CycleChipsView(forecast: forecast, entries: store.cycleEntries)

            CycleRecentCyclesView(forecast: forecast)

            CycleTodayLogView(entry: entry(on: .now)) {
                logTarget = CycleLogTarget(date: .now)
            }
        } else {
            CycleEmptyState {
                showsSetup = true
            }
        }
    }

    private func entry(on date: Date) -> CycleEntry? {
        store.cycleEntries.first { Calendar.current.isDate($0.date, inSameDayAs: date) }
    }

    private func checkSetup() {
        guard store.isLoaded, !checkedSetup else { return }
        checkedSetup = true
        if !store.cycleSettings.isConfigured {
            showsSetup = true
        }
    }
}
