import Charts
import SwiftUI

struct CycleHeroView: View {
    @Environment(\.colorScheme) private var colorScheme
    var forecast: CycleForecast
    var settings: CycleSettings

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 34) {
                headline
                    .frame(maxWidth: .infinity, alignment: .leading)
                CycleOrbitView(forecast: forecast, settings: settings)
                    .frame(width: 226, height: 226)
            }
            VStack(alignment: .leading, spacing: 22) {
                headline
                CycleOrbitView(forecast: forecast, settings: settings)
                    .frame(width: 226, height: 226)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(22)
        .mhdGlassPanel(tint: CyclePalette.rose.opacity(0.08))
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Prossimo ciclo stimato", systemImage: "calendar.circle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(CyclePalette.rose)

            Text("Fra \(countdownShort)")
                .font(.system(.largeTitle, design: .rounded, weight: .bold))
                .fixedSize(horizontal: false, vertical: true)

            Text(CycleDateText.full(forecast.nextPeriodStart))
                .font(.title3.weight(.medium))
                .foregroundStyle(.secondary)

            Label(forecast.methodDescription, systemImage: "wand.and.stars")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(CyclePalette.secondarySurface(for: colorScheme), in: Capsule())

            if settings.showsFertileWindow {
                Label("Finestra fertile stimata: \(CycleDateText.range(forecast.upcomingFertileWindow))", systemImage: "leaf.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(CyclePalette.fertile)
            }

            Text("Stima indicativa basata sul calendario: non è un metodo contraccettivo.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    private var countdownShort: String {
        let days = Calendar.current.dateComponents(
            [.day],
            from: Calendar.current.startOfDay(for: .now),
            to: forecast.nextPeriodStart
        ).day ?? 0
        switch days {
        case ..<0: return "\(abs(days)) g di ritardo"
        case 0: return "oggi"
        case 1: return "domani"
        default: return "\(days) g"
        }
    }
}

private struct CycleOrbitView: View {
    @Environment(\.colorScheme) private var colorScheme
    var forecast: CycleForecast
    var settings: CycleSettings

    private var phase: CyclePhase { forecast.phase(on: .now) }

    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            let markerRadius = (size / 2) - 11
            let visibleDay = min(max(forecast.currentCycleDay, 1), forecast.cycleLength)
            let fraction = Double(visibleDay - 1) / Double(forecast.cycleLength)
            let angle = (fraction * 2 * Double.pi) - (Double.pi / 2)

            ZStack {
                Circle()
                    .stroke(Color.secondary.opacity(0.13), lineWidth: 16)

                Circle()
                    .trim(from: 0, to: min(Double(forecast.periodLength) / Double(forecast.cycleLength), 1))
                    .stroke(CyclePalette.coral, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                    .rotationEffect(.degrees(-90))

                if settings.showsFertileWindow {
                    let fertileStart = Double(max(forecast.cycleLength - 19, 0)) / Double(forecast.cycleLength)
                    let fertileEnd = Double(max(forecast.cycleLength - 13, 0)) / Double(forecast.cycleLength)
                    Circle()
                        .trim(from: min(fertileStart, 1), to: min(fertileEnd, 1))
                        .stroke(CyclePalette.fertile, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }

                VStack(spacing: 4) {
                    Text("GIORNO")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                    Text("\(forecast.currentCycleDay)")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                    Text(phase.shortTitle)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(phaseColor)
                }

                Circle()
                    .fill(CyclePalette.surface(for: colorScheme))
                    .frame(width: 18, height: 18)
                    .overlay(Circle().stroke(CyclePalette.rose, lineWidth: 5))
                    .position(
                        x: (size / 2) + CGFloat(cos(angle)) * markerRadius,
                        y: (size / 2) + CGFloat(sin(angle)) * markerRadius
                    )
            }
            .frame(width: size, height: size)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Giorno \(forecast.currentCycleDay) del ciclo, \(phase.title)")
    }

    private var phaseColor: Color {
        switch phase {
        case .menstrual: CyclePalette.rose
        case .fertile: CyclePalette.fertile
        case .follicular: .blue
        case .luteal: CyclePalette.ovulation
        }
    }
}

private struct CycleQuickFactsView: View {
    var forecast: CycleForecast
    var settings: CycleSettings

    private var columns: [GridItem] {
        [GridItem(.adaptive(minimum: 150), spacing: 10)]
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 10) {
            if settings.showsFertileWindow {
                CycleFact(
                    icon: "leaf.fill",
                    title: "Finestra fertile",
                    value: CycleDateText.range(forecast.upcomingFertileWindow),
                    tint: CyclePalette.fertile
                )
            }
            CycleFact(
                icon: "arrow.triangle.2.circlepath",
                title: "Durata usata",
                value: "\(forecast.cycleLength) giorni",
                tint: CyclePalette.rose
            )
            CycleFact(
                icon: "drop.fill",
                title: "Mestruazioni",
                value: "Circa \(forecast.periodLength) giorni",
                tint: CyclePalette.coral
            )
        }
    }
}

private struct CycleFact: View {
    @Environment(\.colorScheme) private var colorScheme
    var icon: String
    var title: String
    var value: String
    var tint: Color

    var body: some View {
        HStack(spacing: 11) {
            Image(systemName: icon)
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(tint.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .mhdGlassPanel(tint: tint.opacity(0.06))
    }
}

struct CycleKPIRow: View {
    var forecast: CycleForecast
    var settings: CycleSettings

    private var columns: [GridItem] {
        [GridItem(.adaptive(minimum: 150), spacing: 10)]
    }

    private var average: Int { forecast.averageTrackedCycleLength ?? forecast.cycleLength }

    private var variation: Int? { forecast.cycleVariation }

    private var variationNote: String {
        guard let variation else { return "Dati insufficienti" }
        if variation == 0 { return "Stabile" }
        return "± \(max(Int(ceil(Double(variation) / 2)), 1)) g"
    }

    private var regularityLabel: String {
        guard let variation else { return "In raccolta" }
        switch variation {
        case ...3: return "Regolare"
        case ...7: return "Variabile"
        default: return "Irregolare"
        }
    }

    private var regularityNote: String {
        guard let variation else { return "Servono più cicli" }
        return "Variazione \(variation) g"
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 10) {
            CycleKPI(icon: "arrow.triangle.2.circlepath", title: "Ciclo medio", value: "\(average) g", note: variationNote, tint: CyclePalette.rose)
            CycleKPI(icon: "drop.fill", title: "Mestruazioni", value: "\(forecast.periodLength) g", note: "Durata media", tint: CyclePalette.coral)
            CycleKPI(icon: "clock.arrow.circlepath", title: "Ultimo ciclo", value: forecast.latestRecordedStart.mhdRelativeDescription(), note: CycleDateText.short(forecast.latestRecordedStart), tint: CyclePalette.ovulation)
            CycleKPI(icon: "waveform.path.ecg", title: "Regolarità", value: regularityLabel, note: regularityNote, tint: CyclePalette.fertile)
        }
    }
}

private struct CycleKPI: View {
    var icon: String
    var title: String
    var value: String
    var note: String
    var tint: Color

    var body: some View {
        HStack(spacing: 11) {
            Image(systemName: icon)
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(tint.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .mhdGlassPanel(tint: tint.opacity(0.06))
    }
}

struct CyclePhaseExplanation: View {
    let phase: CyclePhase

    private var explanation: String {
        switch phase {
        case .menstrual: "Giorni di flusso registrati o previsti per questo ciclo."
        case .follicular: "Fase dopo le mestruazioni e prima dell'ovulazione stimata."
        case .fertile: "Finestra fertile stimata intorno all'ovulazione."
        case .luteal: "Fase dopo l'ovulazione stimata e prima del prossimo ciclo."
        }
    }

    private var tint: Color {
        switch phase {
        case .menstrual: CyclePalette.rose
        case .fertile: CyclePalette.fertile
        case .follicular: .blue
        case .luteal: CyclePalette.ovulation
        }
    }

    var body: some View {
        Label(explanation, systemImage: "info.circle")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .mhdGlassPanel(tint: tint.opacity(0.05))
    }
}

struct CycleChipsView: View {
    var forecast: CycleForecast
    var entries: [CycleEntry]

    private var lastCycleEntries: [CycleEntry] {
        let start = forecast.latestRecordedStart
        guard let end = Calendar.current.date(byAdding: .day, value: max(forecast.periodLength, 14), to: start) else { return [] }
        return entries.filter { $0.date >= start && $0.date < end }
    }

    private var symptoms: [String] {
        lastCycleEntries
            .flatMap { ($0.symptoms ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) } }
            .filter { !$0.isEmpty }
            .uniqued()
    }

    private var moods: [CycleEntry.Mood] {
        lastCycleEntries.compactMap(\.mood).uniqued()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ultimo ciclo").font(.title3.bold())
            if symptoms.isEmpty && moods.isEmpty {
                Text("Nessun sintomo o umore registrato per l'ultimo ciclo.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 116), spacing: 8)], spacing: 8) {
                    ForEach(moods) { mood in
                        CycleChip(title: mood.label, symbol: mood.systemImage, tint: CyclePalette.ovulation)
                    }
                    ForEach(symptoms, id: \.self) { symptom in
                        CycleChip(title: symptom, symbol: "circle.fill", tint: CyclePalette.rose)
                    }
                }
            }
        }
    }
}

private struct CycleChip: View {
    var title: String
    var symbol: String
    var tint: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: symbol).font(.caption2)
            Text(title).font(.caption.weight(.medium)).lineLimit(1)
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .mhdGlassCapsule(tint: tint.opacity(0.12))
    }
}


private extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
