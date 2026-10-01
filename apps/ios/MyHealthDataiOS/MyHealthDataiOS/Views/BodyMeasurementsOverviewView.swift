import SwiftUI

func bodyMeasurementFavoriteID(for type: MeasurementType) -> String {
    "measurement:\(type.rawValue)"
}

struct BodyMeasurementFavoriteButton: View {
    let type: MeasurementType
    let favoriteMeasurementIDs: Set<String>
    let onToggle: ((MeasurementType) -> Void)?

    var body: some View {
        if let onToggle {
            MHDMetricFavoriteButton(
                type: type,
                tint: .blue,
                isFavorite: favoriteMeasurementIDs.contains(bodyMeasurementFavoriteID(for: type)),
                onToggle: { onToggle(type) }
            )
        }
    }
}

struct BodyMeasurementsFavoritesView: View {
    @Environment(HealthDataStore.self) private var store

    let favoriteTypes: [MeasurementType]
    let favoriteMeasurementIDs: Set<String>
    let onToggleMeasurementFavorite: ((MeasurementType) -> Void)?

    private static let columns = [
        GridItem(.adaptive(minimum: 150, maximum: 230), spacing: 12)
    ]

    var body: some View {
        if favoriteTypes.isEmpty {
            ContentUnavailableView(
                "Nessuna misura preferita",
                systemImage: "star",
                description: Text("Aggiungi una stella a una misura per mostrarla qui.")
            )
        } else {
            LazyVGrid(columns: Self.columns, spacing: 12) {
                ForEach(favoriteTypes) { type in
                    favoriteMeasurementCard(type)
                }
            }
        }
    }

    private func favoriteMeasurementCard(_ type: MeasurementType) -> some View {
        let paired = pairedMeasurementTypes(for: type)
        let latest = paired == nil ? store.measurements(for: type).first : nil

        return VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .top, spacing: 8) {
                Text(type.label).font(.subheadline.weight(.semibold)).lineLimit(2)
                Spacer(minLength: 0)
                BodyMeasurementFavoriteButton(
                    type: type,
                    favoriteMeasurementIDs: favoriteMeasurementIDs,
                    onToggle: onToggleMeasurementFavorite
                )
            }
            if let paired {
                HStack(spacing: 12) {
                    pairedFavoriteValue("Sx", type: paired.0)
                    pairedFavoriteValue("Dx", type: paired.1)
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(latest?.value.formatted(.number.precision(.fractionLength(0...1))) ?? "-")
                        .font(.system(size: 27, weight: .bold, design: .rounded)).monospacedDigit()
                    if let latest { Text(latest.unit).font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
                }
            }
            Text(latest?.measuredAt.mhdRelativeDescription() ?? "Nessun dato")
                .font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 102, alignment: .leading)
        .padding(14)
        .mhdGlassPanel(tint: MHDPalette.aqua.opacity(0.045))
    }

    private func pairedFavoriteValue(_ label: String, type: MeasurementType) -> some View {
        let latest = store.measurements(for: type).first
        return VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(latest?.value.formatted(.number.precision(.fractionLength(0...1))) ?? "-")
                .font(.headline.monospacedDigit())
            Text(latest?.unit ?? "cm").font(.caption2).foregroundStyle(.secondary)
        }
    }
}

struct BodyMeasurementsOverviewView: View {
    @Environment(HealthDataStore.self) private var store

    let favoriteMeasurementIDs: Set<String>
    let onToggleMeasurementFavorite: ((MeasurementType) -> Void)?
    let onOpenDetail: (MeasurementType) -> Void
    let onAddMeasurement: () -> Void
    @Binding var isShowingWeightGoal: Bool
    @Binding var weightGoal: Double
    @Binding var weightGoalStart: Double
    @Binding var weightGoalStartDate: Double
    let showsDerivedEstimates: Bool

    private static let featuredColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    private static let singleColumns = [
        GridItem(.adaptive(minimum: 150, maximum: 230), spacing: 12)
    ]

    private static let pairs: [(String, MeasurementType, MeasurementType)] = [
        ("Braccio", .leftArmCircumference, .rightArmCircumference),
        ("Avambraccio", .leftForearmCircumference, .rightForearmCircumference),
        ("Coscia", .leftThighCircumference, .rightThighCircumference),
        ("Polpaccio", .leftCalfCircumference, .rightCalfCircumference)
    ]

    private static let singles: [(String, MeasurementType)] = [
        ("Collo", .neckCircumference),
        ("Spalle", .shoulderCircumference),
        ("Vita", .waistCircumference),
        ("Fianchi", .hipCircumference),
        ("Torace", .chestCircumference),
        ("Addome superiore", .upperAbdomenCircumference),
        ("Addome inferiore", .lowerAbdomenCircumference)
    ]

    private var latestWeightKg: Double? {
        store.measurements(for: .weight).first.map { normalizedWeight($0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            LazyVGrid(columns: Self.featuredColumns, spacing: 12) {
                WeightTrendCard(
                    values: normalizedWeightValues(),
                    onOpen: { onOpenDetail(.weight) },
                    onAdd: onAddMeasurement,
                    isFavorite: favoriteMeasurementIDs.contains(bodyMeasurementFavoriteID(for: .weight)),
                    onToggleFavorite: { onToggleMeasurementFavorite?(.weight) }
                )
                CompactWeightGoalCard(
                    currentWeight: latestWeightKg,
                    goalWeight: weightGoal,
                    startWeight: weightGoalStart,
                    onEdit: { isShowingWeightGoal = true }
                )
            }

            HStack {
                Text("Circonferenze").font(.title2.bold())
                Spacer()
                Button("Aggiungi", systemImage: "plus", action: onAddMeasurement)
                    .font(.subheadline.weight(.semibold))
                    .mhdGlassButton(prominent: true)
            }
            .padding(.top, 4)

            pairedTable

            LazyVGrid(columns: Self.singleColumns, spacing: 12) {
                ForEach(Array(Self.singles.enumerated()), id: \.offset) { _, single in
                    singleMeasurementCard(title: single.0, type: single.1)
                }
            }

            compositionSection
            sizesSection

            if showsDerivedEstimates { derivedEstimatesSection }
        }
    }

    private func favoriteButton(for type: MeasurementType) -> some View {
        BodyMeasurementFavoriteButton(
            type: type,
            favoriteMeasurementIDs: favoriteMeasurementIDs,
            onToggle: onToggleMeasurementFavorite
        )
    }

    private func normalizedWeightValues() -> [Measurement] {
        store.measurements(for: .weight).map { measurement in
            var normalized = measurement
            normalized.value = normalizedWeight(measurement)
            normalized.unit = "kg"
            return normalized
        }
    }

    private func normalizedWeight(_ measurement: Measurement) -> Double {
        switch measurement.unit.lowercased() {
        case "lb", "lbs": measurement.value * 0.45359237
        default: measurement.value
        }
    }

    @ViewBuilder
    private var pairedTable: some View {
        let rows = Self.pairs.compactMap { pair -> (String, Measurement?, Measurement?)? in
            let left = store.measurements(for: pair.1).first
            let right = store.measurements(for: pair.2).first
            guard left != nil || right != nil else { return nil }
            return (pair.0, left, right)
        }

        if !rows.isEmpty {
            VStack(spacing: 0) {
                HStack {
                    Text("Zona").font(.caption.bold()).foregroundStyle(.secondary)
                    Spacer()
                    Text("Sinistra").font(.caption.bold()).foregroundStyle(.secondary).frame(width: 90, alignment: .trailing)
                    Text("Destra").font(.caption.bold()).foregroundStyle(.secondary).frame(width: 90, alignment: .trailing)
                }
                .padding(.bottom, 4)
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    Divider()
                    HStack {
                        Text(row.0).font(.subheadline)
                        Spacer()
                        favoriteButton(for: pairType(for: row.0))
                        pairedValue(row.1)
                        pairedValue(row.2)
                    }
                    .padding(.vertical, 8)
                }
            }
            .padding(16)
            .mhdGlassPanel(tint: .blue.opacity(0.045))
        }
    }

    private func pairType(for title: String) -> MeasurementType {
        Self.pairs.first(where: { $0.0 == title })?.1 ?? .armCircumference
    }

    private func pairedValue(_ measurement: Measurement?) -> some View {
        Group {
            if let measurement {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(measurement.value.formatted(.number.precision(.fractionLength(0...1)))) \(measurement.unit)")
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                    Text(measurement.measuredAt.mhdRelativeDescription())
                        .font(.caption2).foregroundStyle(.secondary)
                }
            } else {
                Text("-").font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .frame(width: 90, alignment: .trailing)
    }

    private func singleMeasurementCard(title: String, type: MeasurementType) -> some View {
        let latest = store.measurements(for: type).first
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(title).font(.subheadline.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 0)
                favoriteButton(for: type)
            }
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(latest?.value.formatted(.number.precision(.fractionLength(0...1))) ?? "-")
                    .font(.system(size: 27, weight: .bold, design: .rounded)).monospacedDigit()
                if let latest { Text(latest.unit).font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
                Spacer()
            }
            Text(latest?.measuredAt.mhdRelativeDescription() ?? "Nessun dato")
                .font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 86, alignment: .leading)
        .padding(14)
        .mhdGlassPanel(tint: MHDPalette.aqua.opacity(0.045))
    }

    private var compositionSection: some View {
        let weight = store.measurements(for: .weight).first.map { normalizedWeight($0) } ?? store.snapshot.profile?.currentWeightKg
        let height = store.measurements(for: .height).first?.value ?? store.snapshot.profile?.heightCm
        let bmi: Double? = {
            guard let weight, let height, height > 0 else { return nil }
            return weight / pow(height / 100, 2)
        }()
        let bodyFat = store.measurements(for: .bodyFatPercentage).first
        let lean = store.measurements(for: .leanBodyMass).first

        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Composizione").font(.title2.bold())
                Spacer()
            }
            LazyVGrid(columns: Self.singleColumns, spacing: 12) {
                compositionCard(type: .bodyMassIndex, title: "BMI", value: bmi, unit: "kg/m²", note: "Calcolato da peso e altezza")
                compositionCard(type: .bodyFatPercentage, title: "Massa grassa", value: bodyFat?.value, unit: bodyFat?.unit ?? "%", note: bodyFat?.measuredAt.mhdRelativeDescription())
                compositionCard(type: .leanBodyMass, title: "Massa magra", value: lean?.value, unit: lean?.unit ?? "kg", note: lean?.measuredAt.mhdRelativeDescription())
            }
        }
        .padding(.top, 4)
    }

    private func compositionCard(type: MeasurementType, title: String, value: Double?, unit: String, note: String?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(title).font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                favoriteButton(for: type)
            }
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(value?.formatted(.number.precision(.fractionLength(0...1))) ?? "-")
                    .font(.system(size: 27, weight: .bold, design: .rounded)).monospacedDigit()
                Text(unit).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
            }
            if let note {
                Text(note).font(.caption2).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 86, alignment: .leading)
        .padding(14)
        .mhdGlassPanel(tint: .blue.opacity(0.045))
    }

    private var sizesSection: some View {
        BodySizesBlock(latestWeight: latestWeightKg)
    }

    @ViewBuilder
    private var derivedEstimatesSection: some View {
        let estimates = BodyCompositionEstimates(store: store)
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Stime derivate").font(.title2.bold())
                Spacer()
                Image(systemName: "function").foregroundStyle(.orange)
            }
            Text("Calcolate da peso, altezza, età e sesso biologico. Non provengono dagli elettrodi della bilancia.")
                .font(.caption).foregroundStyle(.secondary)
            LazyVGrid(columns: Self.singleColumns, spacing: 12) {
                EstimateCard(title: "BMI", value: estimates.bmi, unit: "", symbol: "figure")
                EstimateCard(title: "Grasso stimato", value: estimates.bodyFatPercentage, unit: "%", symbol: "percent")
                EstimateCard(title: "Massa magra stimata", value: estimates.leanMass, unit: "kg", symbol: "figure.strengthtraining.traditional")
            }
        }
        .padding(.top, 4)
    }
}

private func pairedMeasurementTypes(for type: MeasurementType) -> (MeasurementType, MeasurementType)? {
    switch type {
    case .armCircumference: (.leftArmCircumference, .rightArmCircumference)
    case .forearmCircumference: (.leftForearmCircumference, .rightForearmCircumference)
    case .thighCircumference: (.leftThighCircumference, .rightThighCircumference)
    case .calfCircumference: (.leftCalfCircumference, .rightCalfCircumference)
    default: nil
    }
}
