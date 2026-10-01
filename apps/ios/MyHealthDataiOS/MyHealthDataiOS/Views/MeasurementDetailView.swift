import Charts
import SwiftUI

struct MeasurementDetailView: View {
    @Environment(HealthDataStore.self) private var store
    let type: MeasurementType
    let title: String
    let symbol: String
    let tint: Color

    @State private var timeWindow = HealthTimeWindow(scale: .month, anchor: .now)
    @State private var pendingDeletion: Measurement?
    @State private var editingMeasurement: Measurement?
    @State private var editingWorkout: Measurement?
    @State private var historyLimit = 100
    @State private var selectedChartPoint: MeasurementDetailChartPoint?

    private var visibleValues: [Measurement] {
        store.measurements(for: type, from: timeWindow.start, to: timeWindow.end)
    }
    private var pagedValues: ArraySlice<Measurement> { visibleValues.prefix(historyLimit) }
    private var chartPoints: [MeasurementDetailChartPoint] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: visibleValues) { value in
            if timeWindow.scale == .all || timeWindow.scale == .year {
                return calendar.dateInterval(of: .weekOfYear, for: value.measuredAt)?.start ?? calendar.startOfDay(for: value.measuredAt)
            }
            return calendar.startOfDay(for: value.measuredAt)
        }
        return grouped.compactMap { date, values in
            guard let unit = values.first?.unit else { return nil }
            let matching = values.filter { $0.unit == unit }
            guard !matching.isEmpty else { return nil }
            let aggregate = type.usesDailySum
                ? matching.reduce(0) { $0 + $1.value }
                : matching.reduce(0) { $0 + $1.value } / Double(matching.count)
            return MeasurementDetailChartPoint(date: date, value: aggregate)
        }
        .sorted { $0.date < $1.date }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                MHDModuleHeader(title: title, subtitle: "Andamento e misure registrate", symbol: symbol, tint: tint)
                CompactHealthTimeNavigator(window: $timeWindow, tint: tint)
                summaryPanel
                chartPanel
                historyPanel
            }
            .frame(maxWidth: 820)
            .padding()
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: timeWindow) { _, _ in selectedChartPoint = nil }
        .sheet(item: $editingMeasurement) { measurement in
            MeasurementEditView(measurement: measurement) { updated in
                store.updateMeasurement(updated)
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.visible)
        }
        .sheet(item: $editingWorkout) { workout in
            NavigationStack { TreadmillCorrectionView(workout: workout) }
        }
        .confirmationDialog(
            "Eliminare questa misura?",
            isPresented: Binding(
                get: { pendingDeletion != nil },
                set: { if !$0 { pendingDeletion = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Elimina", role: .destructive) {
                guard let pendingDeletion else { return }
                store.deleteMeasurement(id: pendingDeletion.id)
                self.pendingDeletion = nil
            }
            Button("Annulla", role: .cancel) { pendingDeletion = nil }
        }
    }

    @ViewBuilder private var summaryPanel: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
            summaryItem("Primo → ultimo", value: windowDeltaText, symbol: deltaSymbol)
            summaryItem("Media", value: meanText, symbol: "chart.bar.fill")
            summaryItem("Mediana", value: medianText, symbol: "chart.xyaxis.line")
            summaryItem("Minimo", value: minimumText, symbol: "arrow.down.to.line")
            summaryItem("Massimo", value: maximumText, symbol: "arrow.up.to.line")
        }
        if let first = chronologicalValues.first, let last = chronologicalValues.last, chronologicalValues.count > 1 {
            Text("Variazione calcolata da \(display(first)) a \(display(last)).")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func summaryItem(_ label: String, value: String, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Image(systemName: symbol).foregroundStyle(tint)
            Text(value).font(.headline.monospacedDigit()).lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .mhdGlassPanel(tint: tint.opacity(0.05))
    }

    private var chartPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Andamento").font(.title3.bold())
            if chartPoints.isEmpty {
                ContentUnavailableView("Nessun dato", systemImage: "chart.line.uptrend.xyaxis", description: Text("Non ci sono misure nel periodo selezionato."))
                    .frame(height: 220)
            } else {
                Chart(chartPoints) { value in
                    if type.usesDailySum {
                        BarMark(x: .value("Data", value.date), y: .value("Valore", value.value))
                            .foregroundStyle(tint.gradient)
                            .cornerRadius(3)
                    } else {
                        LineMark(x: .value("Data", value.date), y: .value("Valore", value.value))
                            .foregroundStyle(tint)
                            .interpolationMethod(.linear)
                        PointMark(x: .value("Data", value.date), y: .value("Valore", value.value))
                            .foregroundStyle(tint)
                            .symbolSize(chartPoints.count == 1 ? 100 : 28)
                    }
                    if value.id == minimumPoint?.id {
                        PointMark(x: .value("Data", value.date), y: .value("Minimo", value.value))
                            .foregroundStyle(.orange)
                            .symbol(.diamond)
                            .symbolSize(90)
                            .annotation(position: .bottom, overflowResolution: .init(x: .fit, y: .disabled)) {
                                Text("Min \(value.value.formatted(.number.precision(.fractionLength(0...2))))")
                                    .font(.caption2.bold()).foregroundStyle(.orange)
                            }
                    }
                    if value.id == maximumPoint?.id {
                        PointMark(x: .value("Data", value.date), y: .value("Massimo", value.value))
                            .foregroundStyle(.pink)
                            .symbol(.diamond)
                            .symbolSize(90)
                            .annotation(position: .top, overflowResolution: .init(x: .fit, y: .disabled)) {
                                Text("Max \(value.value.formatted(.number.precision(.fractionLength(0...2))))")
                                    .font(.caption2.bold()).foregroundStyle(.pink)
                            }
                    }
                    if value.id == selectedChartPoint?.id {
                        RuleMark(x: .value("Selezione", value.date))
                            .foregroundStyle(tint.opacity(0.45))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        PointMark(x: .value("Selezione", value.date), y: .value("Valore", value.value))
                            .foregroundStyle(tint)
                            .symbolSize(130)
                            .annotation(position: .top, overflowResolution: .init(x: .fit, y: .disabled)) {
                                VStack(spacing: 2) {
                                    Text("\(value.value.formatted(.number.precision(.fractionLength(0...2)))) \(displayUnit)")
                                        .font(.caption.bold())
                                    Text(value.date.formatted(date: .abbreviated, time: .omitted))
                                        .font(.caption2).foregroundStyle(.secondary)
                                }
                                .padding(7)
                                .background(.thinMaterial, in: Capsule())
                            }
                    }
                }
                .chartXAxis { AxisMarks(values: .automatic(desiredCount: 5)) }
                .chartYScale(domain: AdaptiveChartDomain.range(for: chartPoints.map(\.value)))
                .chartOverlay { proxy in
                    GeometryReader { geometry in
                        Rectangle().fill(.clear).contentShape(Rectangle())
                            .gesture(
                                DragGesture(minimumDistance: 0)
                                    .onEnded { gesture in
                                        guard let frame = proxy.plotFrame else { return }
                                        let plotFrame = geometry[frame]
                                        let x = gesture.location.x - plotFrame.origin.x
                                        guard x >= 0, x <= plotFrame.width,
                                              let date: Date = proxy.value(atX: x) else { return }
                                        selectedChartPoint = chartPoints.min {
                                            abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date))
                                        }
                                    }
                            )
                    }
                }
                .frame(height: 250)
            }
        }
        .padding(18)
        .mhdGlassPanel(tint: tint.opacity(0.04))
    }

    private var historyPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Storico").font(.title3.bold())
            if visibleValues.isEmpty {
                Text("Nessuna misura nel periodo selezionato.")
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 18)
            } else {
                ForEach(pagedValues) { value in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 12) {
                            Image(systemName: symbol)
                                .foregroundStyle(tint)
                                .frame(width: 40, height: 40)
                                .mhdGlassCircle(tint: tint.opacity(0.10))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(display(value)).font(.headline.monospacedDigit())
                                Text(value.measuredAt.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("Modifica", systemImage: "pencil") { editingMeasurement = value }
                                .labelStyle(.iconOnly)
                                .buttonStyle(.plain)
                                .foregroundStyle(tint)
                                .frame(width: 38, height: 38)
                            Button("Elimina", systemImage: "trash", role: .destructive) { pendingDeletion = value }
                                .labelStyle(.iconOnly)
                                .buttonStyle(.plain)
                                .foregroundStyle(.red)
                                .frame(width: 38, height: 38)
                        }
                        if type == .workoutMinutes {
                            Button {
                                editingWorkout = value
                            } label: {
                                Label("Modifica distanza e tapis roulant", systemImage: "pencil.and.list.clipboard")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(tint)
                            }
                            .buttonStyle(.plain)
                            .padding(.leading, 52)
                        }
                    }
                    .padding(.vertical, 4)
                    if value.id != pagedValues.last?.id { Divider().opacity(0.45) }
                }
                if pagedValues.count < visibleValues.count {
                    Button("Carica altre misure") { historyLimit += 100 }
                        .frame(maxWidth: .infinity)
                        .mhdGlassButton()
                }
            }
        }
        .padding(18)
        .mhdGlassPanel()
    }

    private var chronologicalValues: [Measurement] {
        visibleValues.sorted { $0.measuredAt < $1.measuredAt }
    }

    private var windowDelta: Double? {
        guard let first = chronologicalValues.first, let last = chronologicalValues.last, chronologicalValues.count >= 2, first.unit == last.unit else { return nil }
        return last.value - first.value
    }

    private var windowDeltaText: String {
        guard let windowDelta, let unit = chronologicalValues.first?.unit else { return "-" }
        return "\(windowDelta > 0 ? "+" : "")\(windowDelta.formatted(.number.precision(.fractionLength(0...2)))) \(unit)"
    }

    private var meanText: String {
        guard let unit = visibleValues.first?.unit else { return "-" }
        let values = visibleValues.filter { $0.unit == unit }.map(\.value)
        guard !values.isEmpty else { return "-" }
        return "\((values.reduce(0, +) / Double(values.count)).formatted(.number.precision(.fractionLength(0...2)))) \(unit)"
    }

    private var medianText: String {
        guard let unit = visibleValues.first?.unit else { return "-" }
        let values = visibleValues.filter { $0.unit == unit }.map(\.value).sorted()
        guard !values.isEmpty else { return "-" }
        let middle = values.count / 2
        let median = values.count.isMultiple(of: 2) ? (values[middle - 1] + values[middle]) / 2 : values[middle]
        return "\(median.formatted(.number.precision(.fractionLength(0...2)))) \(unit)"
    }

    private var minimumPoint: MeasurementDetailChartPoint? { chartPoints.min { $0.value < $1.value } }
    private var maximumPoint: MeasurementDetailChartPoint? { chartPoints.max { $0.value < $1.value } }
    private var minimumText: String { pointText(minimumPoint) }
    private var maximumText: String { pointText(maximumPoint) }

    private func pointText(_ point: MeasurementDetailChartPoint?) -> String {
        guard let point, let unit = visibleValues.first?.unit else { return "-" }
        return "\(point.value.formatted(.number.precision(.fractionLength(0...2)))) \(unit)"
    }

    private var displayUnit: String { visibleValues.first?.unit ?? type.defaultUnit }

    private var deltaSymbol: String {
        guard let windowDelta else { return "minus" }
        return windowDelta > 0 ? "arrow.up.right" : windowDelta < 0 ? "arrow.down.right" : "arrow.right"
    }

    private func display(_ value: Measurement) -> String {
        "\(value.value.formatted(.number.precision(.fractionLength(0...2)))) \(value.unit)"
    }
}

private struct MeasurementEditView: View {
    @Environment(\.dismiss) private var dismiss
    let measurement: Measurement
    let onSave: (Measurement) -> Void

    @State private var valueText: String
    @State private var measuredAt: Date
    @State private var note: String

    init(measurement: Measurement, onSave: @escaping (Measurement) -> Void) {
        self.measurement = measurement
        self.onSave = onSave
        _valueText = State(initialValue: measurement.value.formatted(.number.precision(.fractionLength(0...2))))
        _measuredAt = State(initialValue: measurement.measuredAt)
        _note = State(initialValue: measurement.note ?? "")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    MHDModuleHeader(title: "Modifica misura", subtitle: measurement.type.label, symbol: "pencil", tint: MHDPalette.aqua)
                    HStack(spacing: 10) {
                        TextField("Valore", text: $valueText)
                            .keyboardType(.decimalPad)
                            .font(.title2.bold().monospacedDigit())
                        Text(measurement.unit).foregroundStyle(.secondary)
                    }
                    .padding(14)
                    .mhdGlassCapsule(tint: MHDPalette.aqua.opacity(0.05), interactive: true)
                    DatePicker("Data e ora", selection: $measuredAt, displayedComponents: [.date, .hourAndMinute])
                        .padding(14)
                        .mhdGlassCapsule(tint: MHDPalette.aqua.opacity(0.05), interactive: true)
                    TextField("Nota (facoltativa)", text: $note, axis: .vertical)
                        .lineLimit(2...4)
                        .padding(14)
                        .mhdGlassPanel(tint: MHDPalette.aqua.opacity(0.05))
                    Button("Salva modifica") {
                        let normalized = valueText.replacingOccurrences(of: ",", with: ".")
                        guard let value = Double(normalized), value.isFinite, value >= 0 else { return }
                        var updated = measurement
                        updated.value = value
                        updated.measuredAt = measuredAt
                        updated.note = note.nilIfBlank
                        onSave(updated)
                        dismiss()
                    }
                    .frame(maxWidth: .infinity)
                    .mhdGlassButton(prominent: true)
                }
                .padding()
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { dismiss() }
                }
            }
        }
    }
}

private struct MeasurementDetailChartPoint: Identifiable {
    let date: Date
    let value: Double
    var id: Date { date }
}
