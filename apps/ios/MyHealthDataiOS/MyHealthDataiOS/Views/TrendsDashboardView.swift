import Charts
import SwiftUI

struct EnhancedTrendsDashboardView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var selectedSeriesID: String?
    @State private var range: TrendChartRange = .days30
    @State private var isAddingMeasurement = false

    private let tint = Color.green

    private var seriesOptions: [MeasurementSeriesKey] {
        Set(store.measurements.map { MeasurementSeriesKey(type: $0.type, unit: $0.unit) })
            .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }

    private var selectedSeries: MeasurementSeriesKey? {
        seriesOptions.first { $0.id == selectedSeriesID } ?? seriesOptions.first
    }

    private var visibleMeasurements: [Measurement] {
        guard let selectedSeries else { return [] }
        let start = Calendar.current.date(byAdding: .day, value: -range.days, to: .now) ?? .distantPast
        return store.measurements
            .filter {
                $0.type == selectedSeries.type &&
                    $0.unit == selectedSeries.unit &&
                    $0.measuredAt >= start
            }
            .sorted { $0.measuredAt < $1.measuredAt }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                DashboardSection(title: "Serie") {
                    if seriesOptions.isEmpty {
                        ContentUnavailableView("Nessuna serie disponibile", systemImage: "chart.xyaxis.line")
                            .frame(maxWidth: .infinity, minHeight: 220)
                    } else {
                        controls
                        trendChart
                        summary
                    }
                }
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Trend")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isAddingMeasurement) {
            NavigationStack { AddMeasurementView() }
        }
        .onChange(of: seriesOptions.map(\.id)) { _, identifiers in
            if let selectedSeriesID, !identifiers.contains(selectedSeriesID) {
                self.selectedSeriesID = identifiers.first
            }
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            Image(systemName: "chart.xyaxis.line")
                .font(.title2.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 44, height: 44)
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 3) {
                Text("Andamento delle misure")
                    .font(.headline)
                Text("\(seriesOptions.count) serie per tipo e unità")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button { isAddingMeasurement = true } label: {
                Image(systemName: "plus")
            }
            .buttonStyle(.borderedProminent)
            .tint(tint)
            .accessibilityLabel("Nuova misura")
        }
        .padding(14)
        .background(.background, in: RoundedRectangle(cornerRadius: 8))
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Serie e unità", selection: seriesSelection) {
                ForEach(seriesOptions) { option in
                    Text(option.displayName).tag(option.id)
                }
            }
            .pickerStyle(.menu)
            RangePicker(selection: $range, options: TrendChartRange.allCases)
        }
    }

    @ViewBuilder
    private var trendChart: some View {
        if visibleMeasurements.isEmpty {
            ContentUnavailableView(
                "Nessuna misura nel periodo",
                systemImage: "calendar",
                description: Text("Seleziona un intervallo piu ampio.")
            )
            .frame(maxWidth: .infinity, minHeight: 230)
        } else {
            Chart(visibleMeasurements) { measurement in
                LineMark(
                    x: .value("Data", measurement.measuredAt),
                    y: .value("Valore", measurement.value)
                )
                .foregroundStyle(tint)
                PointMark(
                    x: .value("Data", measurement.measuredAt),
                    y: .value("Valore", measurement.value)
                )
                .foregroundStyle(tint)
                .symbolSize(40)
            }
            .chartYAxis { AxisMarks(position: .leading) }
            .chartYScale(domain: AdaptiveChartDomain.range(for: visibleMeasurements.map(\.value)))
            .frame(height: 250)
            .padding(12)
            .background(.background, in: RoundedRectangle(cornerRadius: 8))
        }
    }

    @ViewBuilder
    private var summary: some View {
        if let statistics = TrendStatistics(measurements: visibleMeasurements), let selectedSeries {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    StatisticCell(title: "Min", value: format(statistics.minimum, unit: selectedSeries.unit))
                    StatisticCell(title: "Media", value: format(statistics.average, unit: selectedSeries.unit))
                    StatisticCell(title: "Max", value: format(statistics.maximum, unit: selectedSeries.unit))
                }
                Divider()
                VStack(alignment: .leading, spacing: 5) {
                    Text("Confronto tra metà del periodo")
                        .font(.subheadline.weight(.semibold))
                    Text(statistics.comparison(unit: selectedSeries.unit))
                        .font(.subheadline)
                    Text("Copertura: \(visibleMeasurements.count) punti · \(chartCoverage(visibleMeasurements.map(\.measuredAt)))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("Prima metà: \(statistics.firstHalfCount) · Seconda metà: \(statistics.secondHalfCount)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(12)
            .background(.background, in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private var seriesSelection: Binding<String> {
        Binding(
            get: { selectedSeries?.id ?? "" },
            set: { selectedSeriesID = $0 }
        )
    }
}
