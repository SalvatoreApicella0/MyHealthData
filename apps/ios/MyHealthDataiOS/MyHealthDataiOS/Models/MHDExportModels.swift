import Foundation

struct MHDExportFile: Codable, Equatable {
    struct Manifest: Codable, Equatable {
        var app: String = "MyHealthData"
        var schemaVersion: String = "0.1.0"
        var formatVersion: String = "mhd-json-0.1"
        var packageId: String
        var exportedAt: Date
        var exportedBy: String = "ios-local"
        var appVersion: String?
        var buildNumber: String?

        init(
            exportedAt: Date,
            packageId: String = "mhdpkg_\(UUID().uuidString)",
            appVersion: String? = nil,
            buildNumber: String? = nil
        ) {
            self.packageId = packageId
            self.exportedAt = exportedAt
            self.appVersion = appVersion
            self.buildNumber = buildNumber
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            app = try container.decodeIfPresent(String.self, forKey: .app) ?? "MyHealthData"
            schemaVersion = try container.decodeIfPresent(String.self, forKey: .schemaVersion) ?? "0.1.0"
            formatVersion = try container.decodeIfPresent(String.self, forKey: .formatVersion) ?? "mhd-json-0.1"
            packageId = try container.decodeIfPresent(String.self, forKey: .packageId) ?? "mhdpkg_legacy"
            exportedAt = try container.decodeIfPresent(Date.self, forKey: .exportedAt) ?? .distantPast
            exportedBy = try container.decodeIfPresent(String.self, forKey: .exportedBy) ?? "ios-local"
            appVersion = try container.decodeIfPresent(String.self, forKey: .appVersion)
            buildNumber = try container.decodeIfPresent(String.self, forKey: .buildNumber)
        }
    }

    struct Metadata: Codable, Equatable {
        struct RecordCounts: Codable, Equatable {
            var profile: Int
            var events: Int
            var measurements: Int
            var documents: Int
            var cycleEntries: Int
            var sleepSessions: Int
            var appointments: Int
            var medications: Int
            var medicationDoseEvents: Int
            var conditionEpisodes: Int
            var conditionCheckIns: Int
            var labResults: Int
            var foodLogEntries: Int
            var gymPlans: Int
            var gymWorkouts: Int
            var attachments: Int
            var preciseBodyPoints: Int
            var totalRecords: Int

            init(
                profile: Int = 0,
                events: Int,
                measurements: Int,
                documents: Int,
                cycleEntries: Int = 0,
                sleepSessions: Int = 0,
                appointments: Int = 0,
                medications: Int = 0,
                medicationDoseEvents: Int = 0,
                conditionEpisodes: Int = 0,
                conditionCheckIns: Int = 0,
                labResults: Int = 0,
                foodLogEntries: Int = 0,
                gymPlans: Int = 0,
                gymWorkouts: Int = 0,
                attachments: Int = 0,
                preciseBodyPoints: Int = 0,
                totalRecords: Int? = nil
            ) {
                self.profile = profile
                self.events = events
                self.measurements = measurements
                self.documents = documents
                self.cycleEntries = cycleEntries
                self.sleepSessions = sleepSessions
                self.appointments = appointments
                self.medications = medications
                self.medicationDoseEvents = medicationDoseEvents
                self.conditionEpisodes = conditionEpisodes
                self.conditionCheckIns = conditionCheckIns
                self.labResults = labResults
                self.foodLogEntries = foodLogEntries
                self.gymPlans = gymPlans
                self.gymWorkouts = gymWorkouts
                self.attachments = attachments
                self.preciseBodyPoints = preciseBodyPoints
                self.totalRecords = totalRecords ?? (
                    profile
                        + events
                        + measurements
                        + documents
                        + cycleEntries
                        + sleepSessions
                        + appointments
                        + medications
                        + medicationDoseEvents
                        + conditionEpisodes
                        + conditionCheckIns
                        + labResults
                        + foodLogEntries
                        + gymPlans
                        + gymWorkouts
                )
            }

            init(snapshot: MHDDataSnapshot) {
                self.init(
                    profile: snapshot.profile == nil ? 0 : 1,
                    events: snapshot.events.count,
                    measurements: snapshot.measurements.count,
                    documents: snapshot.documents.count,
                    cycleEntries: snapshot.cycleEntries.count,
                    sleepSessions: snapshot.sleepSessions.count,
                    appointments: snapshot.appointments.count,
                    medications: snapshot.medications.count,
                    medicationDoseEvents: snapshot.medicationDoseEvents.count,
                    conditionEpisodes: snapshot.conditionEpisodes.count,
                    conditionCheckIns: snapshot.conditionCheckIns.count,
                    labResults: snapshot.labResults.count,
                    foodLogEntries: snapshot.foodLogEntries.count,
                    gymPlans: snapshot.gymPlans.count,
                    gymWorkouts: snapshot.gymWorkouts.count,
                    attachments: snapshot.events.reduce(0) { $0 + $1.attachments.count }
                        + snapshot.documents.compactMap(\.attachment).count,
                    preciseBodyPoints: snapshot.events.compactMap(\.bodyPoint).count
                )
            }

            func matches(snapshot: MHDDataSnapshot) -> Bool {
                self == RecordCounts(snapshot: snapshot)
            }

            private enum CodingKeys: String, CodingKey {
                case profile
                case events
                case measurements
                case documents
                case cycleEntries
                case sleepSessions
                case appointments
                case medications
                case medicationDoseEvents
                case conditionEpisodes
                case conditionCheckIns
                case labResults
                case foodLogEntries
                case gymPlans
                case gymWorkouts
                case attachments
                case preciseBodyPoints
                case totalRecords
            }

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                profile = try container.decodeIfPresent(Int.self, forKey: .profile) ?? 0
                events = try container.decodeIfPresent(Int.self, forKey: .events) ?? 0
                measurements = try container.decodeIfPresent(Int.self, forKey: .measurements) ?? 0
                documents = try container.decodeIfPresent(Int.self, forKey: .documents) ?? 0
                cycleEntries = try container.decodeIfPresent(Int.self, forKey: .cycleEntries) ?? 0
                sleepSessions = try container.decodeIfPresent(Int.self, forKey: .sleepSessions) ?? 0
                appointments = try container.decodeIfPresent(Int.self, forKey: .appointments) ?? 0
                medications = try container.decodeIfPresent(Int.self, forKey: .medications) ?? 0
                medicationDoseEvents = try container.decodeIfPresent(Int.self, forKey: .medicationDoseEvents) ?? 0
                conditionEpisodes = try container.decodeIfPresent(Int.self, forKey: .conditionEpisodes) ?? 0
                conditionCheckIns = try container.decodeIfPresent(Int.self, forKey: .conditionCheckIns) ?? 0
                labResults = try container.decodeIfPresent(Int.self, forKey: .labResults) ?? 0
                foodLogEntries = try container.decodeIfPresent(Int.self, forKey: .foodLogEntries) ?? 0
                gymPlans = try container.decodeIfPresent(Int.self, forKey: .gymPlans) ?? 0
                gymWorkouts = try container.decodeIfPresent(Int.self, forKey: .gymWorkouts) ?? 0
                attachments = try container.decodeIfPresent(Int.self, forKey: .attachments) ?? 0
                preciseBodyPoints = try container.decodeIfPresent(Int.self, forKey: .preciseBodyPoints) ?? 0
                totalRecords = try container.decodeIfPresent(Int.self, forKey: .totalRecords)
                    ?? (profile
                        + events
                        + measurements
                        + documents
                        + cycleEntries
                        + sleepSessions
                        + appointments
                        + medications
                        + medicationDoseEvents
                        + conditionEpisodes
                        + conditionCheckIns
                        + labResults
                        + foodLogEntries
                        + gymPlans
                        + gymWorkouts)
            }
        }

        var source: String = "ios-local"
        var encrypted: Bool = false
        var recordCounts: RecordCounts

        init(source: String = "ios-local", encrypted: Bool = false, recordCounts: RecordCounts) {
            self.source = source
            self.encrypted = encrypted
            self.recordCounts = recordCounts
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            source = try container.decodeIfPresent(String.self, forKey: .source) ?? "ios-local"
            encrypted = try container.decodeIfPresent(Bool.self, forKey: .encrypted) ?? false
            recordCounts = try container.decodeIfPresent(RecordCounts.self, forKey: .recordCounts)
                ?? RecordCounts(snapshot: .empty)
        }
    }

    struct Integrity: Codable, Equatable {
        var algorithm: String = "SHA-256"
        var recordsSHA256: String
        var recordCountsSHA256: String
        var generatedAt: Date
    }

    var manifest: Manifest
    var profile: LocalProfile?
    var events: [HealthEvent]
    var measurements: [Measurement]
    var documents: [HealthDocument]
    var cycleEntries: [CycleEntry]
    var cycleSettings: CycleSettings
    var sleepSessions: [SleepSession]
    var sleepSettings: SleepSettings
    var appointments: [AppointmentRecord]
    var medications: [MedicationStatement]
    var medicationDoseEvents: [MedicationDoseEvent]
    var conditionEpisodes: [ConditionEpisode]
    var conditionCheckIns: [ConditionCheckIn]
    var labResults: [LabResult]
    var foodLogEntries: [FoodLogEntry]
    var foodRecipes: [FoodRecipe]
    var gymPlans: [GymPlan]
    var gymWorkouts: [GymWorkout]
    var metadata: Metadata
    var integrity: Integrity?

    init(
        snapshot: MHDDataSnapshot,
        exportedAt: Date = .now,
        packageId: String = "mhdpkg_\(UUID().uuidString)",
        appVersion: String? = nil,
        buildNumber: String? = nil
    ) {
        self.manifest = Manifest(
            exportedAt: exportedAt,
            packageId: packageId,
            appVersion: appVersion,
            buildNumber: buildNumber
        )
        self.profile = snapshot.profile
        self.events = snapshot.events
        self.measurements = snapshot.measurements
        self.documents = snapshot.documents
        self.cycleEntries = snapshot.cycleEntries
        self.cycleSettings = snapshot.cycleSettings
        self.sleepSessions = snapshot.sleepSessions
        self.sleepSettings = snapshot.sleepSettings
        self.appointments = snapshot.appointments
        self.medications = snapshot.medications
        self.medicationDoseEvents = snapshot.medicationDoseEvents
        self.conditionEpisodes = snapshot.conditionEpisodes
        self.conditionCheckIns = snapshot.conditionCheckIns
        self.labResults = snapshot.labResults
        self.foodLogEntries = snapshot.foodLogEntries
        self.foodRecipes = snapshot.foodRecipes
        self.gymPlans = snapshot.gymPlans
        self.gymWorkouts = snapshot.gymWorkouts
        self.metadata = Metadata(recordCounts: Metadata.RecordCounts(snapshot: snapshot))
        self.integrity = nil
    }

    private enum CodingKeys: String, CodingKey {
        case manifest
        case profile
        case events
        case measurements
        case documents
        case cycleEntries
        case cycleSettings
        case sleepSessions
        case sleepSettings
        case appointments
        case medications
        case medicationDoseEvents
        case conditionEpisodes
        case conditionCheckIns
        case labResults
        case foodLogEntries
        case foodRecipes
        case gymPlans
        case gymWorkouts
        case metadata
        case integrity
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        manifest = try container.decode(Manifest.self, forKey: .manifest)
        profile = try container.decodeIfPresent(LocalProfile.self, forKey: .profile)
        events = try container.decodeIfPresent([HealthEvent].self, forKey: .events) ?? []
        measurements = try container.decodeIfPresent([Measurement].self, forKey: .measurements) ?? []
        documents = try container.decodeIfPresent([HealthDocument].self, forKey: .documents) ?? []
        cycleEntries = try container.decodeIfPresent([CycleEntry].self, forKey: .cycleEntries) ?? []
        cycleSettings = try container.decodeIfPresent(CycleSettings.self, forKey: .cycleSettings) ?? CycleSettings()
        sleepSessions = try container.decodeIfPresent([SleepSession].self, forKey: .sleepSessions) ?? []
        sleepSettings = try container.decodeIfPresent(SleepSettings.self, forKey: .sleepSettings) ?? SleepSettings()
        appointments = try container.decodeIfPresent([AppointmentRecord].self, forKey: .appointments) ?? []
        medications = try container.decodeIfPresent([MedicationStatement].self, forKey: .medications) ?? []
        medicationDoseEvents = try container.decodeIfPresent([MedicationDoseEvent].self, forKey: .medicationDoseEvents) ?? []
        conditionEpisodes = try container.decodeIfPresent([ConditionEpisode].self, forKey: .conditionEpisodes) ?? []
        conditionCheckIns = try container.decodeIfPresent([ConditionCheckIn].self, forKey: .conditionCheckIns) ?? []
        labResults = try container.decodeIfPresent([LabResult].self, forKey: .labResults) ?? []
        foodLogEntries = try container.decodeIfPresent([FoodLogEntry].self, forKey: .foodLogEntries) ?? []
        foodRecipes = try container.decodeIfPresent([FoodRecipe].self, forKey: .foodRecipes) ?? []
        gymPlans = try container.decodeIfPresent([GymPlan].self, forKey: .gymPlans) ?? []
        gymWorkouts = try container.decodeIfPresent([GymWorkout].self, forKey: .gymWorkouts) ?? []
        let decodedSnapshot = MHDDataSnapshot(
            profile: profile,
            events: events,
            measurements: measurements,
            documents: documents,
            cycleEntries: cycleEntries,
            cycleSettings: cycleSettings,
            sleepSessions: sleepSessions,
            sleepSettings: sleepSettings,
            appointments: appointments,
            medications: medications,
            medicationDoseEvents: medicationDoseEvents,
            conditionEpisodes: conditionEpisodes,
            conditionCheckIns: conditionCheckIns,
            labResults: labResults,
            foodLogEntries: foodLogEntries,
            foodRecipes: foodRecipes
            , gymPlans: gymPlans, gymWorkouts: gymWorkouts
        )
        metadata = try container.decodeIfPresent(Metadata.self, forKey: .metadata)
            ?? Metadata(recordCounts: Metadata.RecordCounts(snapshot: decodedSnapshot))
        integrity = try container.decodeIfPresent(Integrity.self, forKey: .integrity)
    }

    var snapshot: MHDDataSnapshot {
        MHDDataSnapshot(
            profile: profile,
            events: events,
            measurements: measurements,
            documents: documents,
            cycleEntries: cycleEntries,
            cycleSettings: cycleSettings,
            sleepSessions: sleepSessions,
            sleepSettings: sleepSettings,
            appointments: appointments,
            medications: medications,
            medicationDoseEvents: medicationDoseEvents,
            conditionEpisodes: conditionEpisodes,
            conditionCheckIns: conditionCheckIns,
            labResults: labResults,
            foodLogEntries: foodLogEntries,
            foodRecipes: foodRecipes
            , gymPlans: gymPlans, gymWorkouts: gymWorkouts
        )
    }
}
