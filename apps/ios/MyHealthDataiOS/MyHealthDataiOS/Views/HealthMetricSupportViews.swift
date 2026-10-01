import SwiftUI

struct MetricInfoView: View {
    @Environment(\.dismiss) private var dismiss
    let type: MeasurementType
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Image(systemName: "waveform.path.ecg")
                    .font(.title2)
                    .foregroundStyle(tint)
                    .frame(width: 48, height: 48)
                    .mhdGlassCircle(tint: tint.opacity(0.12))
                Text(type.label).font(.title2.bold())
                Spacer()
                Button("Chiudi", systemImage: "xmark") { dismiss() }.labelStyle(.iconOnly)
            }
            Text(type.userExplanation)
                .font(.body)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(22)
        .navigationTitle("Informazioni")
        .navigationBarTitleDisplayMode(.inline)
    }
}

extension MeasurementType {
    var userExplanation: String {
        switch self {
        case .heartRate: "Indica quante volte il cuore batte in un minuto. Può variare con attività, stress, sonno, temperatura e stato di salute."
        case .restingHeartRate: "È la frequenza cardiaca rilevata nei periodi di riposo. Il suo andamento nel tempo è spesso più utile del singolo valore."
        case .walkingHeartRateAverage: "È la frequenza cardiaca media durante la camminata e aiuta a osservare come il cuore risponde a uno sforzo quotidiano."
        case .heartRateVariability: "Misura la variazione dell'intervallo tra battiti consecutivi. È influenzata da recupero, sonno, stress e allenamento."
        case .oxygenSaturation: "Stima la percentuale di emoglobina che trasporta ossigeno nel sangue."
        case .respiratoryRate: "Indica il numero di respiri al minuto. È particolarmente utile osservata durante il riposo e il sonno."
        case .vo2Max: "Stima la quantità massima di ossigeno utilizzabile durante lo sforzo ed è un indicatore della capacità cardiorespiratoria."
        case .systolicPressure: "È la pressione nelle arterie durante la contrazione del cuore e va interpretata insieme alla pressione diastolica."
        case .diastolicPressure: "È la pressione nelle arterie tra due battiti e va interpretata insieme alla pressione sistolica."
        case .sixMinuteWalkDistance: "Indica la distanza coperta camminando in sei minuti. Riassume capacità funzionale, resistenza e risposta cardiorespiratoria allo sforzo."
        case .bodyTemperature: "Registra la temperatura corporea. Conta soprattutto la variazione rispetto al tuo valore abituale e il metodo con cui è stata misurata."
        case .stepCount: "Conta i passi rilevati durante la giornata. Il totale può provenire da più dispositivi e viene aggregato evitando, quando possibile, le sovrapposizioni."
        case .activeEnergyBurned: "Stima l'energia consumata con movimento e allenamento oltre al metabolismo basale. È una stima, non una misura diretta delle calorie."
        case .basalEnergyBurned: "Stima l'energia necessaria alle funzioni vitali a riposo, sulla base dei dati corporei e del tempo trascorso."
        case .distanceWalkingRunning: "Somma la distanza stimata durante camminata e corsa. La precisione dipende da GPS, calibrazione del passo e dispositivo usato."
        case .flightsClimbed: "Stima i piani saliti usando variazioni di quota e movimento. Un piano corrisponde approssimativamente a una rampa standard."
        case .exerciseMinutes: "Minuti in cui l'intensità dell'attività raggiunge una soglia paragonabile a una camminata sostenuta."
        case .workoutMinutes: "Durata complessiva delle sessioni di allenamento registrate, indipendentemente dall'intensità raggiunta."
        case .standMinutes: "Minuti in cui è stato rilevato movimento in posizione eretta; aiuta a osservare quanto spesso interrompi la sedentarietà."
        case .walkingSpeed: "Velocità stimata durante la camminata. Può cambiare con terreno, stanchezza, dolore, equilibrio e forma fisica."
        case .walkingStepLength: "Distanza media tra due appoggi consecutivi. È influenzata da altezza, velocità, mobilità e superficie."
        case .walkingAsymmetry: "Stima la percentuale di passi in cui il movimento di una gamba differisce dall'altra; variazioni persistenti meritano contesto clinico."
        case .walkingDoubleSupport: "Percentuale del passo trascorsa con entrambi i piedi a terra. Tende ad aumentare quando si cammina più lentamente o con minore stabilità."
        case .stairAscentSpeed: "Velocità stimata mentre sali le scale, utile per osservare nel tempo forza e capacità funzionale."
        case .stairDescentSpeed: "Velocità stimata mentre scendi le scale, influenzata da equilibrio, controllo e mobilità articolare."
        case .distanceCycling: "Distanza percorsa in bicicletta, ricavata da GPS, sensori o attrezzatura collegata."
        case .distanceSwimming: "Distanza nuotata stimata da vasca, stile e rilevamento dei movimenti."
        case .swimmingStrokeCount: "Numero di bracciate rilevate durante il nuoto; insieme a distanza e tempo aiuta a valutare l'efficienza."
        case .daylightMinutes: "Tempo stimato trascorso alla luce naturale, utile come contesto per ritmo sonno-veglia e abitudini quotidiane."
        case .physicalEffort: "Stima l'intensità dello sforzo rispetto al peso corporeo, combinando movimento e risposta fisiologica quando disponibili."
        default: "Questa metrica descrive un aspetto specifico della tua salute. Osserva soprattutto l'andamento nel tempo e la fonte del dato, non il singolo valore isolato."
        }
    }
}

struct BloodPressureQuickEntry: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let tint: Color
    @State private var systolic = ""
    @State private var diastolic = ""
    @State private var measuredAt = Date.now
    @FocusState private var focusedField: Field?

    private enum Field { case systolic, diastolic }

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                Text("Pressione arteriosa").font(.title2.bold())
                Spacer()
                Button("Chiudi", systemImage: "xmark") { dismiss() }.labelStyle(.iconOnly)
            }
            HStack(spacing: 12) {
                pressureField("Sistolica", value: $systolic, field: .systolic)
                Text("/").font(.title.bold()).foregroundStyle(.secondary)
                pressureField("Diastolica", value: $diastolic, field: .diastolic)
                Text("mmHg").foregroundStyle(.secondary)
            }
            DatePicker("Data e ora", selection: $measuredAt, in: ...Date.now).datePickerStyle(.compact)
            Button("Salva") {
                guard let sys = number(systolic), let dia = number(diastolic) else { return }
                store.addMeasurement(Measurement(type: .systolicPressure, value: sys, unit: "mmHg", measuredAt: measuredAt))
                store.addMeasurement(Measurement(type: .diastolicPressure, value: dia, unit: "mmHg", measuredAt: measuredAt))
                dismiss()
            }
            .mhdGlassButton(prominent: true)
            .disabled(number(systolic) == nil || number(diastolic) == nil)
        }
        .padding(22)
        .onAppear { focusedField = .systolic }
    }

    private func pressureField(_ title: String, value: Binding<String>, field: Field) -> some View {
        VStack(spacing: 4) {
            TextField("0", text: value)
                .font(.system(size: 38, weight: .bold, design: .rounded))
                .multilineTextAlignment(.center).keyboardType(.numberPad).focused($focusedField, equals: field)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .padding(12).mhdGlassCapsule(tint: tint.opacity(0.08), interactive: true)
    }

    private func number(_ value: String) -> Double? { Double(value.replacingOccurrences(of: ",", with: ".")) }
}

struct MetricQuickEntry: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let type: MeasurementType
    let tint: Color
    @State private var value = ""
    @State private var measuredAt = Date.now
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 22) {
            HStack { Text(type.label).font(.title2.bold()); Spacer(); Button("Chiudi", systemImage: "xmark") { dismiss() }.labelStyle(.iconOnly) }
            HStack(alignment: .firstTextBaseline) {
                TextField("0", text: $value).font(.system(size: 48, weight: .bold, design: .rounded))
                    .multilineTextAlignment(.center).keyboardType(.decimalPad).focused($focused)
                Text(type.defaultUnit).foregroundStyle(.secondary)
            }.padding().mhdGlassCapsule(tint: tint.opacity(0.08), interactive: true)
            DatePicker("Data e ora", selection: $measuredAt, in: ...Date.now)
                .datePickerStyle(.compact)
            Button("Salva") {
                guard let numeric = Double(value.replacingOccurrences(of: ",", with: ".")) else { return }
                store.addMeasurement(Measurement(type: type, value: numeric, unit: type.defaultUnit, measuredAt: measuredAt))
                dismiss()
            }.mhdGlassButton(prominent: true).disabled(Double(value.replacingOccurrences(of: ",", with: ".")) == nil)
        }.padding(22).onAppear { focused = true }
    }
}

struct MetricOrderView: View {
    @Environment(\.dismiss) private var dismiss
    @State var types: [MeasurementType]
    let tint: Color
    @Binding var usesTwoColumns: Bool
    let onSave: ([MeasurementType]) -> Void

    var body: some View {
        List {
            Section("Visualizzazione") {
                Picker("Colonne", selection: $usesTwoColumns) {
                    Label("Una", systemImage: "rectangle").tag(false)
                    Label("Due", systemImage: "square.grid.2x2").tag(true)
                }
                .pickerStyle(.segmented)
            }
            Section("Ordine") {
            ForEach(types) { type in Label(type.label, systemImage: "line.3.horizontal").foregroundStyle(.primary) }
                .onMove { types.move(fromOffsets: $0, toOffset: $1) }
            }
        }
        .environment(\.editMode, .constant(.active))
        .navigationTitle("Ordina grafici")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fine") { onSave(types); dismiss() }.fontWeight(.semibold) } }
    }
}

struct MetricChartPoint: Identifiable {
    var id: Date { date }
    var date: Date
    var value: Double
    var unit: String
}

struct MetricChartData {
    var series: [MetricChartPoint] = []
    var summary: (value: Double, unit: String)?
    var variation: (value: Double, unit: String)?
    var median: (value: Double, unit: String)?
}

private func workoutMetadata(_ note: String?, key: String) -> String? {
    note?.split(separator: "|").map(String.init).first { $0.hasPrefix("\(key)=") }?.dropFirst(key.count + 1).description
}

struct TreadmillCorrectionView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let workout: Measurement
    @State private var distance: Double
    @State private var incline = 0.0
    @State private var weight: Double

    init(workout: Measurement) {
        self.workout = workout
        _distance = State(initialValue: Double(workoutMetadata(workout.note, key: "distance_km") ?? "") ?? max(workout.value / 60 * 4, 0.1))
        _weight = State(initialValue: 70)
    }

    private var speedKPH: Double { distance / max(workout.value / 60, 0.01) }
    private var estimatedCalories: Double {
        let speedMetersMinute = speedKPH * 1_000 / 60
        let oxygenMLKgMinute = 0.1 * speedMetersMinute + 1.8 * speedMetersMinute * (incline / 100) + 3.5
        return max(oxygenMLKgMinute * weight / 1_000 * 5 * workout.value, 0)
    }

    var body: some View {
        Form {
            Section("Workout originale") {
                LabeledContent("Inizio", value: workout.measuredAt.formatted(date: .abbreviated, time: .shortened))
                LabeledContent("Durata", value: "\(workout.value.formatted(.number.precision(.fractionLength(0...1)))) min")
                if let original = workoutMetadata(workout.note, key: "distance_km") { LabeledContent("Distanza Apple Watch", value: "\(original) km") }
                if let energy = workoutMetadata(workout.note, key: "energy_kcal") { LabeledContent("Energia Apple Watch", value: "\(energy) kcal") }
            }
            Section("Dati del tapis roulant") {
                LabeledContent("Distanza") { TextField("km", value: $distance, format: .number).keyboardType(.decimalPad); Text("km") }
                LabeledContent("Pendenza media") { TextField("%", value: $incline, format: .number).keyboardType(.decimalPad); Text("%") }
                LabeledContent("Peso") { TextField("kg", value: $weight, format: .number).keyboardType(.decimalPad); Text("kg") }
                LabeledContent("Velocità ricavata", value: "\(speedKPH.formatted(.number.precision(.fractionLength(1)))) km/h")
            }
            Section("Stima corretta") {
                LabeledContent("Energia", value: "\(estimatedCalories.formatted(.number.precision(.fractionLength(0)))) kcal")
                Text("La stima usa durata, velocità, pendenza e peso. È una correzione locale collegata al workout: non aggiunge passi e non viene sommata di nuovo all'energia Apple Health.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Rifinisci tapis roulant")
        .onAppear { weight = store.measurements(for: .weight).first?.value ?? store.snapshot.profile?.currentWeightKg ?? weight }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva") {
                    let workoutID = workout.sourceRecordId ?? workout.id
                    for type in [MeasurementType.treadmillCorrectedDistance, .treadmillCorrectedEnergy] {
                        store.measurements(for: type).filter { $0.note?.contains("workout_id=\(workoutID)") == true }.forEach { store.deleteMeasurement(id: $0.id) }
                    }
                    let note = "workout_id=\(workoutID)|original_start=\(ISO8601DateFormatter().string(from: workout.measuredAt))|incline=\(incline)|speed_kph=\(speedKPH)"
                    store.addMeasurement(Measurement(type: .treadmillCorrectedDistance, value: distance, unit: "km", measuredAt: workout.measuredAt, note: note))
                    store.addMeasurement(Measurement(type: .treadmillCorrectedEnergy, value: estimatedCalories, unit: "kcal", measuredAt: workout.measuredAt, note: note))
                    dismiss()
                }.disabled(distance <= 0 || weight <= 0 || incline < 0)
            }
        }
    }
}

extension MeasurementType {
    var usesDailySum: Bool {
        switch self {
        case .stepCount, .activeEnergyBurned, .basalEnergyBurned,
             .distanceWalkingRunning, .flightsClimbed, .exerciseMinutes,
             .distanceCycling, .distanceSwimming, .swimmingStrokeCount,
             .wheelchairPushCount, .distanceWheelchair, .dietaryWater,
             .dietaryEnergy, .dietaryCaffeine, .standMinutes, .daylightMinutes,
             .workoutMinutes, .mindfulMinutes, .sleepHours:
            true
        case .alcoholUnits, .treadmillCorrectedDistance, .treadmillCorrectedEnergy:
            true
        default:
            false
        }
    }
}
