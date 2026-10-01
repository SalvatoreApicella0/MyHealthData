import SwiftUI

/// The iOS bundle currently contains no licensed clinical dental mesh. The
/// native viewer below therefore builds a deliberately lightweight procedural
/// odontogram instead of pretending that the human-body mesh is a tooth model.
/// The persisted event contract remains the source of truth for all 32 FDI teeth.
enum DentalToothState: String, CaseIterable, Identifiable {
    case unrecorded
    case healthy
    case observation
    case caries
    case treated
    case crown
    case implant
    case removed

    var id: String { rawValue }

    var title: String {
        switch self {
        case .unrecorded: "Nessun dato"
        case .healthy: "Sano"
        case .observation: "Da controllare"
        case .caries: "Carie"
        case .treated: "Trattato"
        case .crown: "Corona"
        case .implant: "Impianto"
        case .removed: "Rimosso"
        }
    }

    var color: Color {
        switch self {
        case .unrecorded: .secondary
        case .healthy: .green
        case .observation: .orange
        case .caries: .red
        case .treated: .blue
        case .crown: .orange
        case .implant: .purple
        case .removed: .gray
        }
    }

    var symbol: String {
        switch self {
        case .unrecorded: "circle.dashed"
        case .healthy: "checkmark.circle.fill"
        case .observation: "exclamationmark.circle.fill"
        case .caries: "exclamationmark.triangle.fill"
        case .treated: "cross.case.fill"
        case .crown: "crown.fill"
        case .implant: "plus.circle.fill"
        case .removed: "minus.circle.fill"
        }
    }

    var isRemoved: Bool { self == .removed }

    static func from(_ event: HealthEvent?) -> DentalToothState {
        guard let event else { return .unrecorded }
        return DentalToothState(rawValue: DentalContract.resolve(event).state?.rawValue ?? "") ?? .unrecorded
    }

    static var legend: [DentalToothState] { [.healthy, .observation, .caries, .treated, .implant, .removed] }
}

enum DentalIntervention: String, CaseIterable, Identifiable {
    case cleaning
    case check
    case filling
    case rootCanal
    case crown
    case implant
    case extraction
    case restoration
    case pain
    case orthodontics
    case caries
    case brushing
    case flossing
    case mouthwash

    var id: String { rawValue }

    var title: String {
        switch self {
        case .cleaning: "Pulizia professionale"
        case .check: "Controllo"
        case .filling: "Otturazione"
        case .rootCanal: "Devitalizzazione"
        case .crown: "Corona"
        case .implant: "Impianto"
        case .extraction: "Estrazione"
        case .restoration: "Ripristino dente"
        case .pain: "Dolore"
        case .orthodontics: "Ortodonzia"
        case .caries: "Carie"
        case .brushing: "Spazzolamento"
        case .flossing: "Filo interdentale"
        case .mouthwash: "Collutorio"
        }
    }

    var color: Color {
        switch self {
        case .cleaning: .teal
        case .check: .blue
        case .filling: .teal
        case .rootCanal: .indigo
        case .crown: .orange
        case .implant: .purple
        case .extraction: .gray
        case .restoration: .green
        case .pain: .red
        case .orthodontics: .teal
        case .caries: .red
        case .brushing: .green
        case .flossing: .green
        case .mouthwash: .green
        }
    }

    /// Stable action IDs shared with the Web contract where a direct match exists.
    var contractAction: String {
        switch self {
        case .cleaning: "cleaning"
        case .check: "checkup"
        case .filling: "filling"
        case .rootCanal: "rootCanal"
        case .crown: "crown"
        case .implant: "implant"
        case .extraction: "extraction"
        case .restoration: "restoration"
        case .orthodontics: "orthodontics"
        case .caries: "caries"
        case .brushing: "brushing"
        case .flossing: "flossing"
        case .mouthwash: "mouthwash"
        case .pain: "pain"
        }
    }

    static func from(_ raw: String?) -> DentalIntervention {
        guard let action = DentalContract.action(fromRaw: raw) else { return .check }
        return from(action)
    }

    static func from(_ event: HealthEvent?) -> DentalIntervention {
        guard let event, let action = DentalContract.resolve(event).action else { return .check }
        return from(action)
    }

    private static func from(_ action: DentalContract.Action) -> DentalIntervention {
        switch action {
        case .cleaning: .cleaning
        case .checkup: .check
        case .filling: .filling
        case .rootCanal: .rootCanal
        case .crown: .crown
        case .implant: .implant
        case .extraction: .extraction
        case .orthodontics: .orthodontics
        case .caries: .caries
        case .pain: .pain
        case .brushing: .brushing
        case .flossing: .flossing
        case .mouthwash: .mouthwash
        case .restoration: .restoration
        }
    }
}

let dentalUpperFDI = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"]
let dentalLowerFDI = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"]
