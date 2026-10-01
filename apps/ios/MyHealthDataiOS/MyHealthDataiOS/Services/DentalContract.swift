import Foundation

/// Cross-platform dental event contract.
///
/// The Web resolver in `src/core/dental.ts` and this implementation deliberately
/// replay the same normalized event stream: duplicate IDs use the newest
/// revision, events are chronological, extraction is monotonic, and only an
/// explicit restoration can unlock a tooth.
enum DentalContract {
    static let fdiTeeth: [String] = [
        "18", "17", "16", "15", "14", "13", "12", "11",
        "21", "22", "23", "24", "25", "26", "27", "28",
        "31", "32", "33", "34", "35", "36", "37", "38",
        "41", "42", "43", "44", "45", "46", "47", "48",
    ]

    enum Action: String, CaseIterable, Identifiable {
        case cleaning
        case checkup
        case filling
        case rootCanal
        case crown
        case implant
        case extraction
        case orthodontics
        case caries
        case pain
        case brushing
        case flossing
        case mouthwash
        case restoration

        var id: String { rawValue }
    }

    enum State: String, CaseIterable, Identifiable {
        case healthy
        case observation
        case caries
        case treated
        case crown
        case implant
        case removed

        var id: String { rawValue }
    }

    struct EventResolution {
        let event: HealthEvent
        let tooth: String?
        let action: Action?
        let state: State?
        let isRestoration: Bool
    }

    struct ToothProjection {
        let tooth: String
        let state: State?
        let removed: Bool
        let latestEvent: HealthEvent?
        let history: [EventResolution]
    }

    struct Projection {
        let events: [EventResolution]
        let byTooth: [String: ToothProjection]
    }

    /// Resolves one event without applying chronological state rules.
    static func resolve(_ event: HealthEvent) -> EventResolution {
        let values = tagValues(event.tags)
        let action = action(from: values)
        let taggedState = state(from: values, action: action)
        let rawState = normalizeToken(values["state"] ?? values["status"] ?? "")
        let isRestoration = isTrue(values["restored"])
            || action == .restoration
            || rawState == "restored"
        let resolvedState: State?
        if isRestoration && (taggedState == nil || taggedState == .removed) {
            resolvedState = .healthy
        } else {
            resolvedState = taggedState
        }
        return EventResolution(
            event: event,
            tooth: fdiTooth(from: values["tooth"]),
            action: action,
            state: resolvedState,
            isRestoration: isRestoration
        )
    }

    /// Replays the shared contract deterministically, independent of import
    /// order or duplicated sync deliveries.
    static func resolve(_ events: [HealthEvent]) -> Projection {
        let unique = uniqueDentalEvents(events)
        let ordered = unique.sorted(by: compareChronology).map(resolve)

        var histories: [String: [EventResolution]] = [:]
        for entry in ordered {
            guard let tooth = entry.tooth else { continue }
            histories[tooth, default: []].append(entry)
        }

        var byTooth: [String: ToothProjection] = [:]
        for (tooth, history) in histories {
            var state: State?
            var removed = false
            var latestEvent: HealthEvent?

            for entry in history {
                if entry.isRestoration {
                    removed = false
                    state = entry.state == .removed ? .healthy : entry.state ?? .healthy
                    latestEvent = entry.event
                    continue
                }
                if entry.state == .removed {
                    removed = true
                    state = .removed
                    latestEvent = entry.event
                    continue
                }
                if !removed, let entryState = entry.state {
                    state = entryState
                    latestEvent = entry.event
                }
            }

            byTooth[tooth] = ToothProjection(
                tooth: tooth,
                state: state,
                removed: removed,
                latestEvent: latestEvent,
                history: history
            )
        }
        return Projection(events: ordered, byTooth: byTooth)
    }

    /// Exposed for form/history adapters that only have a raw action value.
    static func action(fromRaw raw: String?) -> Action? {
        guard let raw else { return nil }
        return actionAlias[normalizeToken(raw)]
    }

    private static let actionAlias: [String: Action] = [
        "cleaning": .cleaning, "pulizia": .cleaning, "igiene": .cleaning,
        "check": .checkup, "checkup": .checkup, "controllo": .checkup, "visita": .checkup,
        "filling": .filling, "otturazione": .filling,
        "restoration": .restoration, "ripristino": .restoration, "ripristinodente": .restoration,
        "rootcanal": .rootCanal, "devitalizzazione": .rootCanal, "endodonzia": .rootCanal,
        "crown": .crown, "corona": .crown, "implant": .implant, "impianto": .implant,
        "extraction": .extraction, "extracted": .extraction, "estrazione": .extraction, "rimozione": .extraction,
        "orthodontics": .orthodontics, "ortodonzia": .orthodontics,
        "caries": .caries, "carie": .caries, "pain": .pain, "dolore": .pain, "toothache": .pain,
        "brushing": .brushing, "spazzolamento": .brushing,
        "flossing": .flossing, "filo": .flossing,
        "mouthwash": .mouthwash, "collutorio": .mouthwash,
    ]

    private static func action(from values: [String: String]) -> Action? {
        for raw in [values["intervention"], values["action"]].compactMap({ $0 }) {
            if let action = actionAlias[normalizeToken(raw)] { return action }
        }
        return nil
    }

    private static func state(from values: [String: String], action: Action?) -> State? {
        let raw = normalizeToken(values["state"] ?? values["status"] ?? "")
        switch raw {
        case "removed", "extraction", "extracted", "rimosso", "rimossa", "estrazione", "estratto": return .removed
        case "caries", "carie": return .caries
        case "crown", "corona": return .crown
        case "implant", "impianto": return .implant
        case "treated", "restored", "trattato", "intervento": return .treated
        case "healthy", "sano", "sana": return .healthy
        case "observation", "tocheck", "dacontrollare": return .observation
        default: break
        }

        switch action {
        case .caries: return .caries
        case .extraction: return .removed
        case .crown: return .crown
        case .implant: return .implant
        case .filling, .rootCanal, .orthodontics: return .treated
        case .checkup, .pain: return .observation
        default: return nil
        }
    }

    private static func fdiTooth(from raw: String?) -> String? {
        guard let raw else { return nil }
        let tooth = raw.filter { !$0.isWhitespace }
        return fdiTeeth.contains(tooth) ? tooth : nil
    }

    private static func tagValues(_ tags: [String]) -> [String: String] {
        var values: [String: String] = [:]
        for tag in tags {
            guard let separator = tag.firstIndex(of: "=") else { continue }
            let key = String(tag[..<separator]).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !key.isEmpty else { continue }
            let value = String(tag[tag.index(after: separator)...]).trimmingCharacters(in: .whitespacesAndNewlines)
            values[key] = value
        }
        return values
    }

    private static func normalizeToken(_ raw: String) -> String {
        raw.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "it_IT"))
            .filter { $0.isLetter || $0.isNumber }
            .lowercased()
    }

    private static func isTrue(_ raw: String?) -> Bool {
        guard let raw else { return false }
        return ["true", "1", "yes", "si"].contains(normalizeToken(raw))
    }

    private static func uniqueDentalEvents(_ events: [HealthEvent]) -> [HealthEvent] {
        var byID: [String: HealthEvent] = [:]
        for event in events where event.type == .dentalCare {
            guard let previous = byID[event.id] else {
                byID[event.id] = event
                continue
            }
            if isNewerRevision(event, than: previous) {
                byID[event.id] = event
            }
        }
        return Array(byID.values)
    }

    private static func isNewerRevision(_ left: HealthEvent, than right: HealthEvent) -> Bool {
        if left.updatedAt != right.updatedAt { return left.updatedAt > right.updatedAt }
        if left.createdAt != right.createdAt { return left.createdAt > right.createdAt }
        return revisionKey(left) > revisionKey(right)
    }

    private static func revisionKey(_ event: HealthEvent) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(event),
              let value = String(data: data, encoding: .utf8) else {
            return [
                event.id,
                event.description,
                event.tags.joined(separator: "\u{1F}"),
                event.source.rawValue,
                event.sourceRecordId ?? "",
            ].joined(separator: "\u{1E}")
        }
        return value
    }

    private static func compareChronology(_ left: HealthEvent, _ right: HealthEvent) -> Bool {
        if left.occurredAt != right.occurredAt { return left.occurredAt < right.occurredAt }
        if left.createdAt != right.createdAt { return left.createdAt < right.createdAt }
        if left.updatedAt != right.updatedAt { return left.updatedAt < right.updatedAt }
        return left.id < right.id
    }
}
