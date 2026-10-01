import Foundation

struct CycleEntry: Codable, Equatable, Identifiable {
    enum Flow: String, CaseIterable, Codable, Identifiable {
        case spotting
        case light
        case medium
        case heavy

        var id: String { rawValue }

        var label: String {
            switch self {
            case .spotting: "Spotting"
            case .light: "Leggero"
            case .medium: "Medio"
            case .heavy: "Abbondante"
            }
        }
    }

    enum Mood: String, CaseIterable, Codable, Identifiable {
        case low
        case sensitive
        case calm
        case good
        case energetic

        var id: String { rawValue }

        var label: String {
            switch self {
            case .low: "Giu"
            case .sensitive: "Sensibile"
            case .calm: "Serena"
            case .good: "Bene"
            case .energetic: "Energica"
            }
        }

        var systemImage: String {
            switch self {
            case .low: "cloud.rain"
            case .sensitive: "heart"
            case .calm: "leaf"
            case .good: "sun.max"
            case .energetic: "bolt"
            }
        }
    }

    enum OvulationTestResult: String, CaseIterable, Codable, Identifiable {
        case negative
        case positive
        case unclear

        var id: String { rawValue }

        var label: String {
            switch self {
            case .negative: "Negativo"
            case .positive: "Positivo"
            case .unclear: "Non chiaro"
            }
        }
    }

    var id: String = "cycle_\(UUID().uuidString)"
    var date: Date
    var isPeriodStart: Bool
    var isPeriodEnd: Bool
    var isPeriodDay: Bool? = nil
    var flow: Flow?
    var symptoms: String?
    var mood: Mood? = nil
    var energyLevel: Int? = nil
    var basalTemperatureC: Double? = nil
    var ovulationTestResult: OvulationTestResult? = nil
    var note: String?
    var createdAt: Date = .now
    var updatedAt: Date = .now

    init(
        id: String = "cycle_\(UUID().uuidString)",
        date: Date,
        isPeriodStart: Bool,
        isPeriodEnd: Bool,
        isPeriodDay: Bool? = nil,
        flow: Flow? = nil,
        symptoms: String? = nil,
        mood: Mood? = nil,
        energyLevel: Int? = nil,
        basalTemperatureC: Double? = nil,
        ovulationTestResult: OvulationTestResult? = nil,
        note: String? = nil,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.date = date
        self.isPeriodStart = isPeriodStart
        self.isPeriodEnd = isPeriodEnd
        self.isPeriodDay = isPeriodDay
        self.flow = flow
        self.symptoms = symptoms
        self.mood = mood
        self.energyLevel = energyLevel
        self.basalTemperatureC = basalTemperatureC
        self.ovulationTestResult = ovulationTestResult
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id, date, isPeriodStart, isPeriodEnd, isPeriodDay, flow, symptoms, mood
        case energyLevel, basalTemperatureC, ovulationTestResult, note, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? "cycle_\(UUID().uuidString)"
        date = try CycleCalendarDateCoding.decode(from: container, key: .date)
        isPeriodStart = try container.decodeIfPresent(Bool.self, forKey: .isPeriodStart) ?? false
        isPeriodEnd = try container.decodeIfPresent(Bool.self, forKey: .isPeriodEnd) ?? false
        isPeriodDay = try container.decodeIfPresent(Bool.self, forKey: .isPeriodDay)
        flow = try container.decodeIfPresent(Flow.self, forKey: .flow)
        symptoms = try container.decodeIfPresent(String.self, forKey: .symptoms)
        mood = try container.decodeIfPresent(Mood.self, forKey: .mood)
        energyLevel = try container.decodeIfPresent(Int.self, forKey: .energyLevel)
        basalTemperatureC = try container.decodeIfPresent(Double.self, forKey: .basalTemperatureC)
        ovulationTestResult = try container.decodeIfPresent(OvulationTestResult.self, forKey: .ovulationTestResult)
        note = try container.decodeIfPresent(String.self, forKey: .note)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt) ?? .now
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt) ?? createdAt
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try CycleCalendarDateCoding.encode(date, to: &container, key: .date)
        try container.encode(isPeriodStart, forKey: .isPeriodStart)
        try container.encode(isPeriodEnd, forKey: .isPeriodEnd)
        try container.encodeIfPresent(isPeriodDay, forKey: .isPeriodDay)
        try container.encodeIfPresent(flow, forKey: .flow)
        try container.encodeIfPresent(symptoms, forKey: .symptoms)
        try container.encodeIfPresent(mood, forKey: .mood)
        try container.encodeIfPresent(energyLevel, forKey: .energyLevel)
        try container.encodeIfPresent(basalTemperatureC, forKey: .basalTemperatureC)
        try container.encodeIfPresent(ovulationTestResult, forKey: .ovulationTestResult)
        try container.encodeIfPresent(note, forKey: .note)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
    }

    var recordsPeriod: Bool {
        isPeriodDay == true || isPeriodStart || isPeriodEnd || (flow != nil && flow != .spotting)
    }
}

private enum CycleCalendarDateCoding {
    static func decode<Key: CodingKey>(from container: KeyedDecodingContainer<Key>, key: Key) throws -> Date {
        let rawValue = try container.decode(String.self, forKey: key)
        if let components = dateComponents(from: rawValue),
           let localDate = localGregorianCalendar().date(from: components) {
            return localGregorianCalendar().startOfDay(for: localDate)
        }
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let instant = fractionalFormatter.date(from: rawValue) { return instant }
        if let instant = ISO8601DateFormatter().date(from: rawValue) { return instant }
        throw DecodingError.dataCorruptedError(forKey: key, in: container, debugDescription: "Invalid cycle date")
    }

    static func encode<Key: CodingKey>(
        _ date: Date,
        to container: inout KeyedEncodingContainer<Key>,
        key: Key
    ) throws {
        let components = localGregorianCalendar().dateComponents([.year, .month, .day], from: date)
        guard let year = components.year, let month = components.month, let day = components.day else {
            throw EncodingError.invalidValue(date, .init(codingPath: container.codingPath, debugDescription: "Invalid cycle date"))
        }
        let value = String(format: "%04d-%02d-%02d", year, month, day)
        try container.encode(value, forKey: key)
    }

    private static func dateComponents(from value: String) -> DateComponents? {
        let parts = value.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              let year = Int(parts[0]), let month = Int(parts[1]), let day = Int(parts[2]),
              String(format: "%04d-%02d-%02d", year, month, day) == value else { return nil }
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        var utc = Calendar(identifier: .gregorian)
        guard let utcTimeZone = TimeZone(secondsFromGMT: 0) else { return nil }
        utc.timeZone = utcTimeZone
        guard let validated = utc.date(from: components) else { return nil }
        let checked = utc.dateComponents([.year, .month, .day], from: validated)
        guard checked.year == year, checked.month == month, checked.day == day else {
            return nil
        }
        return components
    }

    private static func localGregorianCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar
    }
}

enum CyclePredictionMethod: String, CaseIterable, Codable, Identifiable {
    case typical
    case lastCycle

    var id: String { rawValue }

    var title: String {
        switch self {
        case .typical: "Durata abituale"
        case .lastCycle: "Ultimo ciclo"
        }
    }

    var subtitle: String {
        switch self {
        case .typical: "Usa il numero di giorni che imposti come tuo ritmo abituale."
        case .lastCycle: "Usa la distanza tra gli ultimi due inizi registrati."
        }
    }
}

struct CycleSettings: Codable, Equatable {
    static let allowedCycleLength = 3...60

    var typicalCycleLength: Int
    var typicalPeriodLength: Int
    var predictionMethod: CyclePredictionMethod
    var showsFertileWindow: Bool
    var isConfigured: Bool

    init(
        typicalCycleLength: Int = 28,
        typicalPeriodLength: Int = 5,
        predictionMethod: CyclePredictionMethod = .typical,
        showsFertileWindow: Bool = true,
        isConfigured: Bool = false
    ) {
        self.typicalCycleLength = typicalCycleLength
        self.typicalPeriodLength = typicalPeriodLength
        self.predictionMethod = predictionMethod
        self.showsFertileWindow = showsFertileWindow
        self.isConfigured = isConfigured
    }

    private enum CodingKeys: String, CodingKey {
        case typicalCycleLength
        case typicalPeriodLength
        case predictionMethod
        case showsFertileWindow
        case isConfigured
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        typicalCycleLength = try container.decodeIfPresent(Int.self, forKey: .typicalCycleLength) ?? 28
        typicalPeriodLength = try container.decodeIfPresent(Int.self, forKey: .typicalPeriodLength) ?? 5
        predictionMethod = try container.decodeIfPresent(CyclePredictionMethod.self, forKey: .predictionMethod) ?? .typical
        showsFertileWindow = try container.decodeIfPresent(Bool.self, forKey: .showsFertileWindow) ?? true
        isConfigured = try container.decodeIfPresent(Bool.self, forKey: .isConfigured) ?? false
    }
}
