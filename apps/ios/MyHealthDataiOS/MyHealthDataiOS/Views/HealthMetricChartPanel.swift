import Charts
import SwiftUI

struct HealthMetricChartPanel: View {
    @Environment(HealthDataStore.self) private var store
    let module: HealthMetricModule
    let type: MeasurementType
    let timeWindow: HealthTimeWindow
    let usesTwoColumns: Bool
    let favoriteIDs: Set<String>
    let onToggleFavorite: ((MeasurementType) -> Void)?
    let onOpenDetail: ((MeasurementDetailRequest) -> Void)?
    let onSelectDetail: (MeasurementType) -> Void
    let onShowInfo: (MeasurementType) -> Void
    let onAdd: (MeasurementType) -> Void

    var body: some View {
        let chart = chartData(for: type)
        let series = chart.series
        let minimum = series.min { $0.value < $1.value }
        let maximum = series.max { $0.value < $1.value }
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(type.label).font(usesTwoColumns ? .headline : .title3.bold()).fixedSize(horizontal: false, vertical: true)
                if let summary = chart.summary {
                    Text("Media \(formattedValue(summary.value)) \(summary.unit)")
                        .font(.subheadline).foregroundStyle(module.tint).monospacedDigit()
                    if let variation = chart.variation {
                        Text("Variazione \(variation.value > 0 ? "+" : "")\(formattedValue(variation.value)) \(variation.unit)")
                            .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    }
                    if let median = chart.median {
                        Text("Mediana \(formattedValue(median.value)) \(median.unit)")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                } else {
                    Text("Nessun dato").font(.subheadline).foregroundStyle(.secondary)
                }
            }

            if series.isEmpty {
                HStack { Spacer(); Image(systemName: "chart.line.uptrend.xyaxis").font(.largeTitle).foregroundStyle(.tertiary); Spacer() }
                    .frame(height: 110)
            } else {
                Chart(series) { item in
                    if type.usesDailySum {
                        BarMark(x: .value("Data", item.date), y: .value("Valore", item.value))
                            .foregroundStyle(module.tint.gradient)
                            .cornerRadius(3)
                    } else {
                        LineMark(x: .value("Data", item.date), y: .value("Valore", item.value))
                            .foregroundStyle(module.tint)
                            .interpolationMethod(.linear)
                        PointMark(x: .value("Data", item.date), y: .value("Valore", item.value))
                            .foregroundStyle(module.tint)
                            .symbolSize(series.count == 1 ? 90 : 24)
                    }
                    if item.id == minimum?.id {
                        PointMark(x: .value("Data", item.date), y: .value("Minimo", item.value))
                            .foregroundStyle(.orange)
                            .symbol(.diamond)
                            .symbolSize(usesTwoColumns ? 45 : 72)
                    }
                    if item.id == maximum?.id {
                        PointMark(x: .value("Data", item.date), y: .value("Massimo", item.value))
                            .foregroundStyle(.pink)
                            .symbol(.diamond)
                            .symbolSize(usesTwoColumns ? 45 : 72)
                    }
                }
                .chartXAxis { AxisMarks(values: .automatic(desiredCount: usesTwoColumns ? 2 : 5)) }
                .chartYScale(domain: AdaptiveChartDomain.range(for: series.map(\.value)))
                .frame(height: usesTwoColumns ? 135 : 190)
                if let minimum, let maximum {
                    HStack {
                        Label("Min \(formattedValue(minimum.value)) \(minimum.unit)", systemImage: "arrow.down.to.line")
                            .foregroundStyle(.orange)
                        Spacer()
                        Label("Max \(formattedValue(maximum.value)) \(maximum.unit)", systemImage: "arrow.up.to.line")
                            .foregroundStyle(.pink)
                    }
                    .font(.caption2.weight(.semibold))
                }
            }

            HStack(spacing: 10) {
                Spacer()
                if let onToggleFavorite {
                    let isFavorite = favoriteIDs.contains("measurement:\(type.rawValue)")
                    Button {
                        onToggleFavorite(type)
                    } label: {
                        Image(systemName: isFavorite ? "star.fill" : "star")
                            .frame(width: 34, height: 34)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(isFavorite ? Color.mhdWarm : .secondary)
                    .mhdGlassCircle(tint: module.tint.opacity(0.08), interactive: true)
                    .accessibilityLabel(isFavorite ? "Rimuovi \(type.label) dai preferiti" : "Aggiungi \(type.label) ai preferiti")
                    .accessibilityAddTraits(isFavorite ? .isSelected : [])
                }
                Button { onShowInfo(type) } label: {
                    Image(systemName: "info").frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)
                .mhdGlassCircle(tint: module.tint.opacity(0.08), interactive: true)
                .accessibilityLabel("Informazioni su \(type.label)")
                Button { onAdd(type) } label: {
                    Image(systemName: "plus").frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)
                .mhdGlassCircle(tint: module.tint.opacity(0.12), interactive: true)
                .accessibilityLabel("Aggiungi \(type.label)")
            }
        }
        .padding(18)
        .contentShape(Rectangle())
        .onTapGesture {
            if let onOpenDetail {
                onOpenDetail(MeasurementDetailRequest(type: type, title: type.label, symbol: module.symbol, tint: module.tint))
            } else {
                onSelectDetail(type)
            }
        }
        .mhdGlassPanel(tint: module.tint.opacity(0.05))
    }

    private func chartData(for type: MeasurementType) -> MetricChartData {
        let values = store.measurements(for: type, from: timeWindow.start, to: timeWindow.end)
        guard let unit = values.first?.unit else { return MetricChartData() }
        let matching = values.filter { $0.unit == unit }
        guard !matching.isEmpty else { return MetricChartData() }

        let series = dailyPoints(for: matching, type: type)
        let summary: (value: Double, unit: String)?

        if type.usesDailySum {
            summary = series.isEmpty ? nil : (series.map(\.value).reduce(0, +) / Double(series.count), unit)
        } else {
            summary = (matching.map(\.value).reduce(0, +) / Double(matching.count), unit)
        }

        let chronological = values.sorted { $0.measuredAt < $1.measuredAt }
        let first = chronological.first
        let last = chronological.last
        let variation: (value: Double, unit: String)?
        if chronological.count >= 2, let first, let last, first.unit == last.unit {
            variation = (last.value - first.value, unit)
        } else {
            variation = nil
        }

        let sortedValues = matching.map(\.value).sorted()
        let middle = sortedValues.count / 2
        let medianValue = sortedValues.isEmpty
            ? nil
            : sortedValues.count.isMultiple(of: 2)
                ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
                : sortedValues[middle]
        let median = medianValue.map { ($0, unit) }

        return MetricChartData(series: series, summary: summary, variation: variation, median: median)
    }

    private func dailyPoints(for values: [Measurement], type: MeasurementType) -> [MetricChartPoint] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: values) { value in
            if timeWindow.scale == .all {
                return calendar.dateInterval(of: .weekOfYear, for: value.measuredAt)?.start ?? calendar.startOfDay(for: value.measuredAt)
            }
            return calendar.startOfDay(for: value.measuredAt)
        }
        return grouped.map { date, dayValues in
            let value: Double
            if type.usesDailySum {
                value = dayValues.map(\.value).reduce(0, +)
            } else {
                value = dayValues.map(\.value).reduce(0, +) / Double(dayValues.count)
            }
            return MetricChartPoint(date: date, value: value, unit: dayValues[0].unit)
        }
        .sorted { $0.date < $1.date }
    }

    private func formattedValue(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)))
    }
}
