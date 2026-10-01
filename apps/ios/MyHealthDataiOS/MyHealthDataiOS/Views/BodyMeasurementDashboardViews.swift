import Charts
import SwiftUI

struct WeightTrendCard: View {
    let values: [Measurement]
    let onOpen: () -> Void
    let onAdd: () -> Void
    let isFavorite: Bool
    let onToggleFavorite: () -> Void

    private var chronological: [Measurement] { Array(values.reversed()) }
    private var latest: Measurement? { values.first }
    private var minimum: Measurement? { chronological.min { $0.value < $1.value } }
    private var maximum: Measurement? { chronological.max { $0.value < $1.value } }
    private var delta: Double? {
        let chronological = values.sorted { $0.measuredAt < $1.measuredAt }
        guard let first = chronological.first, let last = chronological.last, chronological.count > 1 else { return nil }
        return last.value - first.value
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button("Peso", systemImage: "scalemass.fill", action: onOpen)
                    .font(.headline)
                    .foregroundStyle(.blue)
                    .buttonStyle(.plain)
                Spacer()
                MHDMetricFavoriteButton(
                    type: .weight,
                    tint: .blue,
                    isFavorite: isFavorite,
                    onToggle: onToggleFavorite
                )
                Button("Aggiungi misura", systemImage: "plus", action: onAdd)
                    .labelStyle(.iconOnly)
                    .frame(minWidth: 44, minHeight: 44)
                    .buttonStyle(.plain)
                    .mhdGlassCircle(tint: .blue.opacity(0.10), interactive: true)
            }
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(latest?.value.formatted(.number.precision(.fractionLength(0...1))) ?? "-")
                    .font(.system(size: 28, weight: .bold, design: .rounded)).monospacedDigit()
                Text(latest?.unit ?? "kg").font(.caption.bold()).foregroundStyle(.secondary)
                if let latest {
                    Text(latest.measuredAt.mhdRelativeDescription())
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
            Text(delta.map { "\($0 > 0 ? "+" : "")\($0.formatted(.number.precision(.fractionLength(0...1)))) kg nel periodo" } ?? "Nessuna variazione nel periodo")
                .font(.caption.weight(.semibold)).foregroundStyle(delta == nil || delta == 0 ? Color.secondary : MHDPalette.mint)
            if chronological.isEmpty {
                Image(systemName: "chart.line.uptrend.xyaxis").foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity, minHeight: 56)
            } else {
                Chart(chronological) { value in
                    LineMark(x: .value("Data", value.measuredAt), y: .value("Peso", value.value))
                        .foregroundStyle(.blue).interpolationMethod(.catmullRom)
                    PointMark(x: .value("Data", value.measuredAt), y: .value("Peso", value.value))
                        .foregroundStyle(.blue).symbolSize(18)
                    if value.id == minimum?.id {
                        PointMark(x: .value("Data", value.measuredAt), y: .value("Minimo", value.value))
                            .foregroundStyle(.orange).symbol(.diamond).symbolSize(55)
                    }
                    if value.id == maximum?.id {
                        PointMark(x: .value("Data", value.measuredAt), y: .value("Massimo", value.value))
                            .foregroundStyle(.pink).symbol(.diamond).symbolSize(55)
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .chartYScale(domain: AdaptiveChartDomain.range(for: chronological.map(\.value)))
                .frame(height: 58)
                if let minimum, let maximum {
                    HStack {
                        Text("Min \(minimum.value.formatted(.number.precision(.fractionLength(0...1)))) kg")
                            .foregroundStyle(.orange)
                        Spacer()
                        Text("Max \(maximum.value.formatted(.number.precision(.fractionLength(0...1)))) kg")
                            .foregroundStyle(.pink)
                    }
                    .font(.caption2.weight(.semibold))
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 158, alignment: .topLeading)
        .padding(14)
        .mhdGlassPanel(tint: .blue.opacity(0.045))
    }
}

struct CompactWeightGoalCard: View {
    let currentWeight: Double?
    let goalWeight: Double
    let startWeight: Double
    let onEdit: () -> Void

    private var hasGoal: Bool { goalWeight > 0 && startWeight > 0 }
    private var current: Double { currentWeight ?? startWeight }
    private var progress: Double {
        let total = abs(startWeight - goalWeight)
        guard hasGoal, total > 0 else { return 0 }
        let completed = goalWeight < startWeight ? startWeight - current : current - startWeight
        return min(max(completed / total, 0), 1)
    }
    private var change: Double { current - startWeight }

    var body: some View {
        Button(action: onEdit) {
            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    Label("Obiettivo", systemImage: "target").font(.headline).foregroundStyle(.blue)
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(.secondary)
                }
                if hasGoal {
                    ZStack {
                        Circle().stroke(Color.blue.opacity(0.12), lineWidth: 11)
                        Circle().trim(from: 0, to: progress)
                            .stroke(Color.blue.gradient, style: StrokeStyle(lineWidth: 11, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                        VStack(spacing: 1) {
                            Text(progress.formatted(.percent.precision(.fractionLength(0))))
                                .font(.title2.bold().monospacedDigit())
                            Text("completato").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                    .frame(width: 92, height: 92).frame(maxWidth: .infinity)
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(signed(change)).font(.caption.bold().monospacedDigit()).foregroundStyle(.orange)
                            Text("variazione").font(.caption2).foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            Text("\(goalWeight.formatted(.number.precision(.fractionLength(0...1)))) kg")
                                .font(.caption.bold().monospacedDigit()).foregroundStyle(.green)
                            Text("obiettivo").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "target").font(.system(size: 38)).foregroundStyle(.blue)
                        Text("Imposta il peso desiderato").font(.subheadline.weight(.semibold)).multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 158, alignment: .topLeading)
            .padding(14)
            .contentShape(Rectangle())
            .mhdGlassPanel(tint: .blue.opacity(0.045))
        }
        .buttonStyle(.plain)
    }

    private func signed(_ value: Double) -> String {
        "\(value > 0 ? "+" : "")\(value.formatted(.number.precision(.fractionLength(0...1)))) kg"
    }
}

struct EstimateCard: View {
    let title: String
    let value: Double?
    let unit: String
    let symbol: String
    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Image(systemName: symbol).foregroundStyle(.orange)
                Spacer()
                Text("STIMA").font(.caption2.bold()).foregroundStyle(.orange)
            }
            Text(title).font(.subheadline.weight(.semibold))
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value?.formatted(.number.precision(.fractionLength(0...1))) ?? "-").font(.title2.bold().monospacedDigit())
                Text(unit).font(.caption).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
        .padding(14)
        .mhdGlassPanel(tint: .orange.opacity(0.045))
    }
}

@MainActor
struct BodyCompositionEstimates {
    let bmi: Double?
    let bodyFatPercentage: Double?
    let leanMass: Double?

    init(store: HealthDataStore) {
        let latestWeight = store.measurements(for: .weight).first
        let weight = latestWeight.map { $0.unit.lowercased() == "lb" ? $0.value * 0.45359237 : $0.value }
            ?? store.snapshot.profile?.currentWeightKg
        let heightCm = store.measurements(for: .height).first?.value ?? store.snapshot.profile?.heightCm
        guard let weight, let heightCm, heightCm > 0 else {
            bmi = nil; bodyFatPercentage = nil; leanMass = nil; return
        }
        let calculatedBMI = weight / pow(heightCm / 100, 2)
        bmi = calculatedBMI
        guard let profile = store.snapshot.profile,
              let birthDateRaw = profile.birthDate,
              let birthDate = ISO8601DateFormatter().date(from: birthDateRaw),
              let age = Calendar.current.dateComponents([.year], from: birthDate, to: .now).year,
              age >= 16,
              profile.biologicalSex == .male || profile.biologicalSex == .female else {
            bodyFatPercentage = nil; leanMass = nil; return
        }
        let sex = profile.biologicalSex == .male ? 1.0 : 0.0
        let fat = min(max(1.20 * calculatedBMI + 0.23 * Double(age) - 10.8 * sex - 5.4, 2), 70)
        bodyFatPercentage = fat
        leanMass = weight * (1 - fat / 100)
    }
}

struct WeightGoalEditor: View {
    @Environment(\.dismiss) private var dismiss
    let latestWeight: Double?
    @Binding var goalWeight: Double
    @Binding var startWeight: Double
    @Binding var startDateTimestamp: Double

    @State private var draftGoal = 0.0
    @State private var draftStart = 0.0
    @State private var draftDate = Date.now

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                MHDModuleHeader(title: "Obiettivo di peso", subtitle: "Un solo obiettivo condiviso in tutta l'app", symbol: "target", tint: .blue)
                numberField("Peso iniziale", value: $draftStart)
                numberField("Peso obiettivo", value: $draftGoal)

                DatePicker("Data di inizio", selection: $draftDate, in: ...Date.now, displayedComponents: .date)
                    .padding(16)
                    .mhdGlassPanel(tint: .blue.opacity(0.04))

            }
            .padding(20)
        }
        .navigationTitle("Obiettivo")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva") {
                    goalWeight = draftGoal
                    startWeight = draftStart
                    startDateTimestamp = draftDate.timeIntervalSince1970
                    dismiss()
                }
                .disabled(draftGoal <= 0 || draftStart <= 0)
            }
        }
        .onAppear {
            draftStart = startWeight > 0 ? startWeight : latestWeight ?? 70
            draftGoal = goalWeight > 0 ? goalWeight : max(draftStart - 5, 30)
            draftDate = startDateTimestamp > 0 ? Date(timeIntervalSince1970: startDateTimestamp) : .now
        }
    }

    private func numberField(_ title: String, value: Binding<Double>) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.headline)
            HStack {
                TextField("0,0", value: value, format: .number.precision(.fractionLength(0...1)))
                    .keyboardType(.decimalPad)
                    .font(.title2.bold().monospacedDigit())
                Text("kg").foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .mhdGlassPanel(tint: .blue.opacity(0.04))
    }
}
