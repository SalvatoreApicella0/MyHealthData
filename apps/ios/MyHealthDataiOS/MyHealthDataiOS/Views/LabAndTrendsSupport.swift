import SwiftUI

struct DashboardSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.title3.bold())
            content
        }
    }
}

struct RangePicker<Option: CaseIterable & Identifiable & Hashable>: View where Option.AllCases: RandomAccessCollection {
    @Binding var selection: Option
    let options: Option.AllCases

    var body: some View {
        Picker("Periodo", selection: $selection) {
            ForEach(options) { option in
                Text(String(describing: option.id)).tag(option)
            }
        }
        .pickerStyle(.segmented)
    }
}

struct StatisticCell: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.subheadline.monospacedDigit().weight(.semibold)).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct LabSeriesKey: Hashable, Identifiable {
    let analyte: String
    let unit: String
    var id: String { "\(analyte)\u{1F}\(unit)" }
    var displayName: String { "\(analyte) (\(unit))" }
}

struct MeasurementSeriesKey: Hashable, Identifiable {
    let type: MeasurementType
    let unit: String
    var id: String { "\(type.rawValue)\u{1F}\(unit)" }
    var displayName: String { "\(type.label) (\(unit))" }
}

struct LabBatchKey: Hashable {
    let panel: String
    let day: Date
    let laboratory: String
}

struct LabResultBatch: Identifiable {
    let key: LabBatchKey
    let results: [LabResult]
    var id: String { "\(key.panel)\u{1F}\(key.day.timeIntervalSinceReferenceDate)\u{1F}\(key.laboratory)" }
}

enum LabChartRange: Int, CaseIterable, Identifiable {
    case days30 = 30
    case days90 = 90
    case days365 = 365
    var id: String { "\(rawValue) gg" }
    var days: Int { rawValue }
}

enum TrendChartRange: Int, CaseIterable, Identifiable {
    case days7 = 7
    case days30 = 30
    case days90 = 90
    case days365 = 365
    var id: String { "\(rawValue) gg" }
    var days: Int { rawValue }
}

struct TrendStatistics {
    let minimum: Double
    let maximum: Double
    let average: Double
    let firstHalfAverage: Double?
    let secondHalfAverage: Double?
    let firstHalfCount: Int
    let secondHalfCount: Int

    init?(measurements: [Measurement]) {
        guard let firstDate = measurements.first?.measuredAt,
              let lastDate = measurements.last?.measuredAt,
              let minimum = measurements.map(\.value).min(),
              let maximum = measurements.map(\.value).max()
        else { return nil }

        let midpoint = firstDate.addingTimeInterval(lastDate.timeIntervalSince(firstDate) / 2)
        let firstHalf = measurements.filter { $0.measuredAt <= midpoint }
        let secondHalf = measurements.filter { $0.measuredAt > midpoint }

        self.minimum = minimum
        self.maximum = maximum
        average = measurements.map(\.value).reduce(0, +) / Double(measurements.count)
        firstHalfAverage = Self.average(firstHalf)
        secondHalfAverage = Self.average(secondHalf)
        firstHalfCount = firstHalf.count
        secondHalfCount = secondHalf.count
    }

    func comparison(unit: String) -> String {
        guard let firstHalfAverage, let secondHalfAverage else {
            return "Dati presenti in una sola metà del periodo selezionato."
        }
        let difference = secondHalfAverage - firstHalfAverage
        let sign = difference > 0 ? "+" : ""
        return "Media prima metà \(format(firstHalfAverage, unit: unit)); seconda metà \(format(secondHalfAverage, unit: unit)) (\(sign)\(number(difference)) \(unit))."
    }

    private static func average(_ measurements: [Measurement]) -> Double? {
        guard !measurements.isEmpty else { return nil }
        return measurements.map(\.value).reduce(0, +) / Double(measurements.count)
    }
}

func decimal(_ text: String) -> Double? {
    let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: ",", with: ".")
    guard !normalized.isEmpty else { return nil }
    return Double(normalized)
}

func optionalText(_ text: String) -> String? {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

func number(_ value: Double) -> String {
    value.formatted(.number.precision(.fractionLength(0...2)))
}

func format(_ value: Double, unit: String) -> String {
    "\(number(value)) \(unit)"
}

func chartCoverage(_ dates: [Date]) -> String {
    guard let first = dates.min(), let last = dates.max() else { return "nessuna data" }
    if Calendar.current.isDate(first, inSameDayAs: last) {
        return first.formatted(date: .abbreviated, time: .omitted)
    }
    return "\(first.formatted(date: .numeric, time: .omitted)) - \(last.formatted(date: .numeric, time: .omitted))"
}
