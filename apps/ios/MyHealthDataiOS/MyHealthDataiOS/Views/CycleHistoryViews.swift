import Charts
import SwiftUI

struct CycleRecentCyclesView: View {
    var forecast: CycleForecast

    private var items: [(start: Date, length: Int?)] {
        let starts = forecast.periodStarts
        let mapped = starts.enumerated().map { index, start -> (Date, Int?) in
            let length: Int? = index + 1 < starts.count
                ? Calendar.current.dateComponents([.day], from: start, to: starts[index + 1]).day
                : nil
            return (start, length)
        }
        return Array(mapped.suffix(6)).reversed()
    }

    private var durations: [(date: Date, length: Int)] {
        items.compactMap { item in item.length.map { (item.start, $0) } }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ultimi 6 cicli").font(.title3.bold())
            if items.isEmpty {
                Text("Nessun ciclo registrato.").font(.subheadline).foregroundStyle(.secondary)
            } else {
                if durations.count >= 2 {
                    Chart(durations, id: \.date) { point in
                        LineMark(x: .value("Ciclo", point.date), y: .value("Giorni", point.length))
                            .foregroundStyle(CyclePalette.rose)
                            .interpolationMethod(.catmullRom)
                        PointMark(x: .value("Ciclo", point.date), y: .value("Giorni", point.length))
                            .foregroundStyle(CyclePalette.rose)
                            .symbolSize(14)
                    }
                    .chartXAxis(.hidden)
                    .chartYAxis(.hidden)
                    .chartYScale(domain: AdaptiveChartDomain.range(for: durations.map { Double($0.length) }))
                    .frame(height: 40)
                }
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack {
                        Text(CycleDateText.short(item.start)).font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(item.length.map { "\($0) g" } ?? "In corso")
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(.secondary)
                        Text(item.start.mhdRelativeDescription())
                            .font(.caption).foregroundStyle(.tertiary)
                            .frame(width: 92, alignment: .trailing)
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .padding(16)
        .mhdGlassPanel(tint: CyclePalette.rose.opacity(0.05))
    }
}

struct CycleTodayLogView: View {
    @Environment(\.colorScheme) private var colorScheme
    var entry: CycleEntry?
    var onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 14) {
                Image(systemName: entry == nil ? "plus.circle.fill" : "checkmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(CyclePalette.rose)
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry == nil ? "Come stai oggi?" : "Il tuo diario di oggi")
                        .font(.headline)
                    Text(summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(.tertiary)
            }
            .padding(16)
            .mhdGlassPanel(tint: CyclePalette.rose.opacity(0.06))
        }
        .buttonStyle(.plain)
    }

    private var summary: String {
        guard let entry else { return "Registra flusso, sintomi, umore e segnali del ciclo." }
        let values = [
            entry.flow?.label,
            entry.mood?.label,
            entry.symptoms
        ].compactMap { $0 }
        return values.isEmpty ? "Dati salvati. Tocca per completarli." : values.joined(separator: " · ")
    }
}

struct CycleEmptyState: View {
    @Environment(\.colorScheme) private var colorScheme
    var onSetup: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "calendar.circle.fill")
                .font(.system(size: 54))
                .foregroundStyle(CyclePalette.rose)
            VStack(spacing: 7) {
                Text("Inizia dal tuo ultimo ciclo")
                    .font(.title2.bold())
                Text("Bastano la data di inizio e le tue durate abituali per creare la prima previsione.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            Button("Configura il ciclo", action: onSetup)
                .mhdGlassButton(prominent: true)
                .controlSize(.large)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 46)
        .padding(.horizontal, 20)
        .mhdGlassPanel(tint: CyclePalette.rose.opacity(0.08))
    }
}

struct CycleHistoryView: View {
    @Environment(\.colorScheme) private var colorScheme
    var forecast: CycleForecast?
    var settings: CycleSettings
    var onSelectDate: (Date) -> Void

    private var items: [CycleHistoryItem] {
        guard let forecast else { return [] }
        let starts = forecast.periodStarts
        return Array(starts.enumerated().map { index, start in
            let length: Int?
            if index + 1 < starts.count {
                length = Calendar.current.dateComponents([.day], from: start, to: starts[index + 1]).day
            } else {
                length = nil
            }
            return CycleHistoryItem(
                start: start,
                cycleLength: length,
                periodLength: forecast.recordedPeriodLength(startingAt: start)
            )
        }.reversed())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 10)], spacing: 10) {
                CycleInsightTile(title: "Ciclo medio", value: averageText, tint: CyclePalette.rose)
                CycleInsightTile(title: "Variazione", value: variationText, tint: CyclePalette.ovulation)
                CycleInsightTile(title: "Mestruazioni", value: "\(settings.typicalPeriodLength) giorni", tint: CyclePalette.coral)
            }

            if let forecast, forecast.historicalCycleLengths.count >= 2 {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Andamento della durata")
                        .font(.title3.bold())
                    Chart(historyPoints(forecast)) { point in
                        LineMark(
                            x: .value("Ciclo", point.date),
                            y: .value("Giorni", point.length)
                        )
                        .foregroundStyle(CyclePalette.rose)
                        .interpolationMethod(.catmullRom)
                        PointMark(
                            x: .value("Ciclo", point.date),
                            y: .value("Giorni", point.length)
                        )
                        .foregroundStyle(CyclePalette.rose)
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading)
                    }
                    .chartYScale(domain: AdaptiveChartDomain.range(for: historyPoints(forecast).map { Double($0.length) }))
                    .chartXAxis {
                        AxisMarks(values: .automatic(desiredCount: 4)) { value in
                            AxisValueLabel(format: .dateTime.month(.abbreviated))
                        }
                    }
                    .frame(height: 180)
                }
                .padding(16)
                .mhdGlassPanel(tint: CyclePalette.rose.opacity(0.06))
            }

            VStack(alignment: .leading, spacing: 12) {
                Text("I tuoi cicli")
                    .font(.title3.bold())

                if items.isEmpty {
                    ContentUnavailableView(
                        "Nessun ciclo registrato",
                        systemImage: "calendar",
                        description: Text("Registra il primo giorno per iniziare lo storico.")
                    )
                } else {
                    ForEach(items) { item in
                        Button { onSelectDate(item.start) } label: {
                            CycleHistoryRow(item: item)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var averageText: String {
        if let average = forecast?.averageTrackedCycleLength { return "\(average) giorni" }
        return "\(settings.typicalCycleLength) giorni"
    }

    private var variationText: String {
        guard let variation = forecast?.cycleVariation else { return "Da scoprire" }
        return variation == 0 ? "Stabile" : "± \(max(Int(ceil(Double(variation) / 2)), 1)) giorni"
    }

    private func historyPoints(_ forecast: CycleForecast) -> [CycleHistoryPoint] {
        zip(forecast.periodStarts.dropFirst(), forecast.historicalCycleLengths).map {
            CycleHistoryPoint(date: $0.0, length: $0.1)
        }
    }
}

private struct CycleHistoryItem: Identifiable {
    var id: Date { start }
    var start: Date
    var cycleLength: Int?
    var periodLength: Int?
}

private struct CycleHistoryPoint: Identifiable {
    var id: Date { date }
    var date: Date
    var length: Int
}

private struct CycleInsightTile: View {
    @Environment(\.colorScheme) private var colorScheme
    var title: String
    var value: String
    var tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Capsule()
                .fill(tint)
                .frame(width: 30, height: 4)
            Text(value)
                .font(.title3.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 82, alignment: .leading)
        .padding(13)
        .mhdGlassPanel(tint: tint.opacity(0.06))
    }
}

private struct CycleHistoryRow: View {
    @Environment(\.colorScheme) private var colorScheme
    var item: CycleHistoryItem

    var body: some View {
        HStack(spacing: 14) {
            VStack(spacing: 0) {
                Text(item.start.formatted(.dateTime.day()))
                    .font(.title2.bold())
                Text(item.start.formatted(.dateTime.month(.abbreviated).locale(CycleDateText.locale)))
                    .font(.caption.weight(.semibold))
            }
            .foregroundStyle(CyclePalette.rose)
            .frame(width: 52, height: 52)
            .background(CyclePalette.rose.opacity(0.10), in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(CycleDateText.full(item.start))
                    .font(.headline)
                HStack(spacing: 10) {
                    if let cycleLength = item.cycleLength {
                        Label("\(cycleLength) giorni", systemImage: "arrow.left.and.right")
                    } else {
                        Text("Ciclo attuale")
                    }
                    if let periodLength = item.periodLength {
                        Label(periodLength == 1 ? "1 giorno" : "\(periodLength) giorni", systemImage: "drop.fill")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.bold())
                .foregroundStyle(.tertiary)
        }
        .padding(13)
        .mhdGlassPanel(tint: CyclePalette.rose.opacity(0.05))
    }
}
