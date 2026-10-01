import Foundation

/// Converts the local snapshot to the JSON representation used by the Hub
/// record API. Keeping this logic separate from transport code makes the
/// sync protocol easier to test without a live Hub.
enum HubSyncCanonicalCodec {
    private static let envelopeKeys: Set<String> = [
        "createdAt",
        "updatedAt",
        "originDeviceId",
        "provenance",
        "revision",
        "deleted",
        "baseRevision"
    ]

    static func encode(_ snapshot: MHDDataSnapshot) throws -> [String: Any] {
        do {
            let data = try MHDDateCoding.encoder.encode(snapshot)
            guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw HubSyncClient.Error.invalidResponse
            }
            return object
        } catch {
            throw HubSyncClient.Error.invalidResponse
        }
    }

    static func decode(_ dictionary: [String: Any]) throws -> MHDDataSnapshot {
        try MHDDateCoding.decoder.decode(
            MHDDataSnapshot.self,
            from: JSONSerialization.data(withJSONObject: dictionary)
        )
    }

    /// Fallback used when any single record breaks strict decoding: each
    /// domain is decoded on its own so one bad payload never blocks the others.
    static func decodeDomains(_ dictionary: [String: Any], into base: MHDDataSnapshot) -> MHDDataSnapshot {
        var value = base
        if let records: [HealthEvent] = try? decodeRecords(dictionary["events"]) { value.events = records }
        if let records: [HealthDocument] = try? decodeRecords(dictionary["documents"]) { value.documents = records }
        if let records: [AppointmentRecord] = try? decodeRecords(dictionary["appointments"]) { value.appointments = records }
        if let records: [CycleEntry] = try? decodeRecords(dictionary["cycleEntries"]) { value.cycleEntries = records }
        if let records: [SleepSession] = try? decodeRecords(dictionary["sleepSessions"]) { value.sleepSessions = records }
        if let records: [FoodLogEntry] = try? decodeRecords(dictionary["foodLogEntries"]) { value.foodLogEntries = records }
        if let records: [GymWorkout] = try? decodeRecords(dictionary["gymWorkouts"]) { value.gymWorkouts = records }
        if let records: [MedicationStatement] = try? decodeRecords(dictionary["medications"]) { value.medications = records }
        if let records: [MedicationDoseEvent] = try? decodeRecords(dictionary["medicationDoseEvents"]) { value.medicationDoseEvents = records }
        if let records: [ConditionEpisode] = try? decodeRecords(dictionary["conditionEpisodes"]) { value.conditionEpisodes = records }
        if let records: [ConditionCheckIn] = try? decodeRecords(dictionary["conditionCheckIns"]) { value.conditionCheckIns = records }
        if let records: [LabResult] = try? decodeRecords(dictionary["labResults"]) { value.labResults = records }
        if let records: [FoodRecipe] = try? decodeRecords(dictionary["foodRecipes"]) { value.foodRecipes = records }
        if let records: [GymPlan] = try? decodeRecords(dictionary["gymPlans"]) { value.gymPlans = records }
        return value
    }

    /// A successfully decoded snapshot is authoritative for the synced
    /// domains only; local-only fields remain untouched.
    static func merge(_ remote: MHDDataSnapshot, into base: MHDDataSnapshot) -> MHDDataSnapshot {
        var value = base
        value.events = remote.events
        value.documents = remote.documents
        value.appointments = remote.appointments
        value.cycleEntries = remote.cycleEntries
        value.sleepSessions = remote.sleepSessions
        value.foodLogEntries = remote.foodLogEntries
        value.gymWorkouts = remote.gymWorkouts
        value.medications = remote.medications
        value.medicationDoseEvents = remote.medicationDoseEvents
        value.conditionEpisodes = remote.conditionEpisodes
        value.conditionCheckIns = remote.conditionCheckIns
        value.labResults = remote.labResults
        value.foodRecipes = remote.foodRecipes
        value.gymPlans = remote.gymPlans
        return value
    }

    static func stripEnvelope(_ record: [String: Any]) -> [String: Any] {
        record.filter { !envelopeKeys.contains($0.key) }
    }

    static func fingerprint(_ record: [String: Any]) -> String {
        let payload = stripEnvelope(record)
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]) else {
            return String(repeating: "0", count: 64)
        }
        return MHDHashing.sha256Hex(data)
    }

    private static func decodeRecords<T: Decodable>(_ raw: Any?) throws -> [T] {
        guard let raw, JSONSerialization.isValidJSONObject(raw) else {
            throw HubSyncClient.Error.invalidResponse
        }
        let data = try JSONSerialization.data(withJSONObject: raw)
        return try MHDDateCoding.decoder.decode([T].self, from: data)
    }
}
