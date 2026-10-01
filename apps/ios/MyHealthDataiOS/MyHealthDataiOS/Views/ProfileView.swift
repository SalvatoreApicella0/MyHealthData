import SwiftUI

struct ProfileView: View {
    @Environment(HealthDataStore.self) private var store

    @State private var alias = ""
    @State private var birthDate = Date()
    @State private var hasBirthDate = false
    @State private var biologicalSex: BiologicalSex?
    @State private var gender = ""
    @State private var heightCm = ""
    @State private var currentWeightKg = ""
    @State private var notes = ""
    @State private var allergies = ""
    @State private var medications = ""
    @State private var conditions = ""

    var body: some View {
        Form {
            Section("Identity") {
                TextField("Alias", text: $alias)
                Toggle("Set birth date", isOn: $hasBirthDate)
                if hasBirthDate {
                    DatePicker("Birth date", selection: $birthDate, displayedComponents: .date)
                }
                Picker("Biological sex", selection: $biologicalSex) {
                    Text("Not set").tag(nil as BiologicalSex?)
                    ForEach(BiologicalSex.allCases) { sex in
                        Text(sex.label).tag(Optional(sex))
                    }
                }
                TextField("Gender", text: $gender)
            }

            Section("Measurements") {
                TextField("Height, cm", text: $heightCm)
                    .keyboardType(.decimalPad)
                TextField("Current weight, kg", text: $currentWeightKg)
                    .keyboardType(.decimalPad)
            }

            Section("Sensitive notes") {
                TextField("Personal notes", text: $notes, axis: .vertical)
                    .lineLimit(2...5)
                TextField("Known allergies", text: $allergies, axis: .vertical)
                    .lineLimit(2...5)
                TextField("Regular medications", text: $medications, axis: .vertical)
                    .lineLimit(2...5)
                TextField("Known conditions", text: $conditions, axis: .vertical)
                    .lineLimit(2...5)
            }

            Section {
                Button("Save local profile") {
                    save()
                }
            }
        }
        .navigationTitle("Profile")
        .onAppear(perform: load)
    }

    private func load() {
        guard let profile = store.snapshot.profile else { return }
        alias = profile.alias ?? ""
        if let birth = profile.birthDate, let parsed = ISO8601DateFormatter().date(from: "\(birth)T00:00:00Z") {
            birthDate = parsed
            hasBirthDate = true
        }
        biologicalSex = profile.biologicalSex
        gender = profile.gender ?? ""
        heightCm = profile.heightCm.map { "\($0)" } ?? ""
        currentWeightKg = profile.currentWeightKg.map { "\($0)" } ?? ""
        notes = profile.personalNotes ?? ""
        allergies = profile.knownAllergies ?? ""
        medications = profile.regularMedications ?? ""
        conditions = profile.knownConditions ?? ""
    }

    private func save() {
        var profile = LocalProfile()
        profile.alias = alias.nilIfBlank
        profile.birthDate = hasBirthDate ? birthDate.formatted(.iso8601.year().month().day()) : nil
        profile.biologicalSex = biologicalSex
        profile.gender = gender.nilIfBlank
        profile.heightCm = Double(heightCm.replacingOccurrences(of: ",", with: "."))
        profile.currentWeightKg = Double(currentWeightKg.replacingOccurrences(of: ",", with: "."))
        profile.personalNotes = notes.nilIfBlank
        profile.knownAllergies = allergies.nilIfBlank
        profile.regularMedications = medications.nilIfBlank
        profile.knownConditions = conditions.nilIfBlank
        profile.updatedAt = .now
        store.saveProfile(profile)
    }
}
