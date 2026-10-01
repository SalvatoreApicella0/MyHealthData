import Charts
import SwiftUI

struct BodyMeasurementAddView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let system: MeasurementSystem

    @State private var measuredAt = Date.now
    @State private var weight = ""
    @State private var bodyFat = ""
    @State private var leanMass = ""
    @State private var armLeft = ""
    @State private var armRight = ""
    @State private var forearmLeft = ""
    @State private var forearmRight = ""
    @State private var thighLeft = ""
    @State private var thighRight = ""
    @State private var calfLeft = ""
    @State private var calfRight = ""
    @State private var neck = ""
    @State private var shoulders = ""
    @State private var waist = ""
    @State private var hips = ""
    @State private var chest = ""
    @State private var upperAbdomen = ""
    @State private var lowerAbdomen = ""
    @State private var showsComposition = false
    @State private var showsCircumferences = false

    private var computedBMI: Double? {
        let weightKg = system == .metric ? number(weight) : number(weight).map { $0 * 0.45359237 }
        let heightCm = store.measurements(for: .height).first?.value ?? store.snapshot.profile?.heightCm
        guard let weightKg, let heightCm, heightCm > 0 else { return nil }
        return weightKg / pow(heightCm / 100, 2)
    }

    var body: some View {
        Form {
            Section {
                DatePicker("Data", selection: $measuredAt, in: ...Date.now, displayedComponents: .date)
                LabeledContent("Peso") { valueField("kg", text: $weight) }
                LabeledContent("BMI") {
                    Text(computedBMI.map { $0.formatted(.number.precision(.fractionLength(0...1))) } ?? "-")
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            } header: {
                Text("Essenziale")
            } footer: {
                Text("Il BMI usa peso e altezza del profilo e non viene salvato come misura.")
            }

            Section {
                DisclosureGroup("Composizione", isExpanded: $showsComposition) {
                    LabeledContent("Massa grassa") { valueField("%", text: $bodyFat) }
                    LabeledContent("Massa magra") { valueField("kg", text: $leanMass) }
                }
                DisclosureGroup("Circonferenze", isExpanded: $showsCircumferences) {
                    Text("Appaiate · cm")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    pairedRow("Braccio", left: $armLeft, right: $armRight)
                    pairedRow("Avambraccio", left: $forearmLeft, right: $forearmRight)
                    pairedRow("Coscia", left: $thighLeft, right: $thighRight)
                    pairedRow("Polpaccio", left: $calfLeft, right: $calfRight)
                    Divider()
                    Text("Singole · cm")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    LabeledContent("Collo") { valueField("cm", text: $neck) }
                    LabeledContent("Spalle") { valueField("cm", text: $shoulders) }
                    LabeledContent("Vita") { valueField("cm", text: $waist) }
                    LabeledContent("Fianchi") { valueField("cm", text: $hips) }
                    LabeledContent("Torace") { valueField("cm", text: $chest) }
                    LabeledContent("Addome superiore") { valueField("cm", text: $upperAbdomen) }
                    LabeledContent("Addome inferiore") { valueField("cm", text: $lowerAbdomen) }
                }
            }
        }
        .navigationTitle("Aggiungi misure")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva", action: save).fontWeight(.semibold).disabled(!hasAnyValue)
            }
        }
    }

    private func valueField(_ unit: String, text: Binding<String>) -> some View {
        HStack {
            TextField("0", text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
            Text(unit).foregroundStyle(.secondary)
        }
    }

    private func pairedRow(_ title: String, left: Binding<String>, right: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline.weight(.semibold))
            HStack {
                HStack(spacing: 6) {
                    Text("Sx").font(.caption).foregroundStyle(.secondary)
                    TextField("0", text: left).keyboardType(.decimalPad).multilineTextAlignment(.trailing).monospacedDigit()
                }
                HStack(spacing: 6) {
                    Text("Dx").font(.caption).foregroundStyle(.secondary)
                    TextField("0", text: right).keyboardType(.decimalPad).multilineTextAlignment(.trailing).monospacedDigit()
                }
            }
        }
    }

    private var hasAnyValue: Bool {
        [weight, bodyFat, leanMass, armLeft, armRight, forearmLeft, forearmRight,
         thighLeft, thighRight, calfLeft, calfRight, neck, shoulders, waist,
         hips, chest, upperAbdomen, lowerAbdomen].contains { number($0) != nil }
    }

    private func number(_ value: String) -> Double? {
        Double(value.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces))
    }

    private func save() {
        let day = Calendar.current.startOfDay(for: measuredAt)
        let weightUnit = system == .metric ? "kg" : "lb"
        let lengthUnit = system == .metric ? "cm" : "in"

        func add(_ type: MeasurementType, _ raw: String, _ unit: String) {
            guard let value = number(raw) else { return }
            store.addMeasurement(Measurement(type: type, value: value, unit: unit, measuredAt: day))
        }

        add(.weight, weight, weightUnit)
        add(.bodyFatPercentage, bodyFat, "%")
        add(.leanBodyMass, leanMass, weightUnit)
        add(.leftArmCircumference, armLeft, lengthUnit)
        add(.rightArmCircumference, armRight, lengthUnit)
        add(.leftForearmCircumference, forearmLeft, lengthUnit)
        add(.rightForearmCircumference, forearmRight, lengthUnit)
        add(.leftThighCircumference, thighLeft, lengthUnit)
        add(.rightThighCircumference, thighRight, lengthUnit)
        add(.leftCalfCircumference, calfLeft, lengthUnit)
        add(.rightCalfCircumference, calfRight, lengthUnit)
        add(.neckCircumference, neck, lengthUnit)
        add(.shoulderCircumference, shoulders, lengthUnit)
        add(.waistCircumference, waist, lengthUnit)
        add(.hipCircumference, hips, lengthUnit)
        add(.chestCircumference, chest, lengthUnit)
        add(.upperAbdomenCircumference, upperAbdomen, lengthUnit)
        add(.lowerAbdomenCircumference, lowerAbdomen, lengthUnit)
        dismiss()
    }
}

private struct BodySizes: Codable, Equatable {
    var shoesEU = ""
    var shoesUK = ""
    var shoesUS = ""
    var shoesUKIsManual = false
    var shoesUSIsManual = false
    var shirt = ""
    var trousers = ""
    var jacket = ""

    private enum CodingKeys: String, CodingKey {
        case shoesEU, shoesUK, shoesUS, shoesUKIsManual, shoesUSIsManual, shirt, trousers, jacket
    }

    init() {}

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        shoesEU = try values.decodeIfPresent(String.self, forKey: .shoesEU) ?? ""
        shoesUK = try values.decodeIfPresent(String.self, forKey: .shoesUK) ?? ""
        shoesUS = try values.decodeIfPresent(String.self, forKey: .shoesUS) ?? ""
        // Legacy values have no provenance: preserve every saved nonempty size as manual.
        shoesUKIsManual = try values.decodeIfPresent(Bool.self, forKey: .shoesUKIsManual) ?? !shoesUK.isEmpty
        shoesUSIsManual = try values.decodeIfPresent(Bool.self, forKey: .shoesUSIsManual) ?? !shoesUS.isEmpty
        shirt = try values.decodeIfPresent(String.self, forKey: .shirt) ?? ""
        trousers = try values.decodeIfPresent(String.self, forKey: .trousers) ?? ""
        jacket = try values.decodeIfPresent(String.self, forKey: .jacket) ?? ""
    }
}

struct BodySizesBlock: View {
    @AppStorage("mhd.sizes") private var sizesRaw = ""
    let latestWeight: Double?

    @State private var sizes = BodySizes()
    @State private var shoeSuggestion: ShoeSizeEquivalent?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Taglie").font(.title2.bold())
                Spacer()
                Text("STIMA").font(.caption2.bold()).foregroundStyle(.orange)
            }
            Text(warningText)
                .font(.caption).foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 8) {
                Text("Scarpe")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                HStack(spacing: 8) {
                    shoeSizeField("EU", text: $sizes.shoesEU)
                    shoeSizeField("UK", text: Binding(get: { sizes.shoesUK }, set: { sizes.shoesUK = $0; sizes.shoesUKIsManual = true }))
                    shoeSizeField("US", text: Binding(get: { sizes.shoesUS }, set: { sizes.shoesUS = $0; sizes.shoesUSIsManual = true }))
                }
                if let shoeSuggestion {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Stima uomo Nike: UK \(shoeSuggestion.uk) · US \(shoeSuggestion.us). La calzata varia per marca.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        if hasConflictingManualShoeSizes {
                            Button("Applica stima ai valori in conflitto") {
                                if sizes.shoesUKIsManual, sizes.shoesUK != shoeSuggestion.uk {
                                    sizes.shoesUK = shoeSuggestion.uk
                                    sizes.shoesUKIsManual = false
                                }
                                if sizes.shoesUSIsManual, sizes.shoesUS != shoeSuggestion.us {
                                    sizes.shoesUS = shoeSuggestion.us
                                    sizes.shoesUSIsManual = false
                                }
                            }
                            .font(.caption.weight(.semibold))
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        } else {
                            Text("Inserita nei campi vuoti o già stimati; ogni valore resta modificabile.")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.top, 2)
                }
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 12)], spacing: 12) {
                sizeField("Maglie", text: $sizes.shirt)
                sizeField("Pantaloni", text: $sizes.trousers)
                sizeField("Giacca", text: $sizes.jacket)
            }
        }
        .padding(16)
        .mhdGlassPanel(tint: .orange.opacity(0.045))
        .onAppear(perform: load)
        .onChange(of: sizes) { _, newValue in persist(newValue) }
        .onChange(of: sizes.shoesEU) { _, value in
            updateShoeSuggestion(for: value)
        }
    }

    private var warningText: String {
        let weight = latestWeight.map { " Ultimo peso rilevato: \($0.formatted(.number.precision(.fractionLength(0...1)))) kg." } ?? ""
        return "La conversione EU→UK/US usa la tabella uomo Nike come stima; taglie e calzata variano per marca: verifica la tabella del produttore.\(weight)"
    }

    private var hasConflictingManualShoeSizes: Bool {
        guard let shoeSuggestion else { return false }
        return (sizes.shoesUKIsManual && !sizes.shoesUK.isEmpty && sizes.shoesUK != shoeSuggestion.uk)
            || (sizes.shoesUSIsManual && !sizes.shoesUS.isEmpty && sizes.shoesUS != shoeSuggestion.us)
    }

    private func sizeField(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            TextField("-", text: text)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .padding(.vertical, 9)
                .mhdGlassCapsule(tint: .orange.opacity(0.06), interactive: true)
        }
    }

    private func shoeSizeField(_ title: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.caption2.weight(.medium)).foregroundStyle(.secondary)
            TextField("—", text: text)
                .keyboardType(.decimalPad)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .monospacedDigit()
                .padding(.vertical, 9)
                .mhdGlassCapsule(tint: .orange.opacity(0.06), interactive: true)
        }
        .frame(maxWidth: .infinity)
    }

    private func updateShoeSuggestion(for rawEU: String) {
        shoeSuggestion = Self.convertEUToNikeMens(rawEU)
        guard let shoeSuggestion else {
            if !sizes.shoesUKIsManual { sizes.shoesUK = "" }
            if !sizes.shoesUSIsManual { sizes.shoesUS = "" }
            return
        }

        if sizes.shoesUK.isEmpty || !sizes.shoesUKIsManual {
            sizes.shoesUK = shoeSuggestion.uk
            sizes.shoesUKIsManual = false
        }
        if sizes.shoesUS.isEmpty || !sizes.shoesUSIsManual {
            sizes.shoesUS = shoeSuggestion.us
            sizes.shoesUSIsManual = false
        }
    }

    private static func convertEUToNikeMens(_ raw: String) -> ShoeSizeEquivalent? {
        // Indicative adult men's values from the same Nike chart used by Web.
        let eu = Double(raw.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "."))
        let chart: [(Double, String, String)] = [
            (35.5, "3", "3.5"), (36, "3.5", "4"), (36.5, "4", "4.5"), (37.5, "4.5", "5"),
            (38, "5", "5.5"), (38.5, "5.5", "6"), (39, "6", "6.5"), (40, "6", "7"),
            (40.5, "6.5", "7.5"), (41, "7", "8"), (42, "7.5", "8.5"), (42.5, "8", "9"),
            (43, "8.5", "9.5"), (44, "9", "10"), (44.5, "9.5", "10.5"), (45, "10", "11"),
            (45.5, "10.5", "11.5"), (46, "11", "12"), (47, "11.5", "12.5"), (47.5, "12", "13"),
            (48, "12.5", "13.5"), (48.5, "13", "14"), (49, "13.5", "14.5")
        ]
        guard let eu, let match = chart.first(where: { $0.0 == eu }) else { return nil }
        return ShoeSizeEquivalent(uk: match.1, us: match.2)
    }

    private func load() {
        guard let data = sizesRaw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(BodySizes.self, from: data) else { return }
        sizes = decoded
    }

    private func persist(_ value: BodySizes) {
        guard let data = try? JSONEncoder().encode(value),
              let raw = String(data: data, encoding: .utf8) else { return }
        sizesRaw = raw
    }
}

private struct ShoeSizeEquivalent: Equatable {
    let uk: String
    let us: String
}

enum MeasurementSystem: String {
    case metric
    case imperial
}
