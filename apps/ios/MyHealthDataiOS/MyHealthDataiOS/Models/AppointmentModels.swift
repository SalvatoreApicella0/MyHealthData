import Foundation

enum VisitCategory: String, CaseIterable, Codable, Identifiable {
    case general, familyMedicine, ophthalmology, dermatology, dentistry, orthodontics, cardiology, neurology, orthopedics, physiatry, physiotherapy, psychology, psychiatry, gynecology, urology, andrology, endocrinology, gastroenterology, pneumology, otolaryngology, audiology, allergy, rheumatology, nephrology, hematology, oncology, infectiousDiseases, pediatrics, nutrition, bloodwork, xray, ctScan, mri, ultrasound, mammography, gastroscopy, colonoscopy, vaccination, therapy, surgery, equipmentPickup, other
    var id: String { rawValue }
    var label: String {
        switch self {
        case .general: "Visita medica"
        case .familyMedicine: "Medico di base"
        case .ophthalmology: "Oculistica"
        case .dermatology: "Dermatologia"
        case .dentistry: "Dentista"
        case .orthodontics: "Ortodonzia"
        case .cardiology: "Cardiologia"
        case .neurology: "Neurologia"
        case .orthopedics: "Ortopedia"
        case .physiatry: "Fisiatria"
        case .physiotherapy: "Fisioterapia"
        case .psychology: "Psicologia"
        case .psychiatry: "Psichiatria"
        case .gynecology: "Ginecologia"
        case .urology: "Urologia"
        case .andrology: "Andrologia"
        case .endocrinology: "Endocrinologia"
        case .gastroenterology: "Gastroenterologia"
        case .pneumology: "Pneumologia"
        case .otolaryngology: "Otorinolaringoiatria"
        case .audiology: "Audiologia"
        case .allergy: "Allergologia"
        case .rheumatology: "Reumatologia"
        case .nephrology: "Nefrologia"
        case .hematology: "Ematologia"
        case .oncology: "Oncologia"
        case .infectiousDiseases: "Malattie infettive"
        case .pediatrics: "Pediatria"
        case .nutrition: "Nutrizione"
        case .bloodwork: "Analisi del sangue"
        case .xray: "Radiografia"
        case .ctScan: "TAC"
        case .mri: "Risonanza magnetica"
        case .ultrasound: "Ecografia"
        case .mammography: "Mammografia"
        case .gastroscopy: "Gastroscopia"
        case .colonoscopy: "Colonscopia"
        case .vaccination: "Vaccinazione"
        case .therapy: "Terapia / trattamento"
        case .surgery: "Intervento chirurgico"
        case .equipmentPickup: "Ritiro attrezzatura"
        case .other: "Altro"
        }
    }
    var symbol: String {
        switch self {
        case .ophthalmology: "eye"
        case .dermatology: "allergens"
        case .dentistry, .orthodontics: "mouth"
        case .cardiology: "heart"
        case .neurology: "brain.head.profile"
        case .orthopedics, .physiatry, .physiotherapy: "figure.walk"
        case .psychology, .psychiatry: "brain"
        case .gynecology: "cross.case"
        case .urology, .andrology: "cross.case"
        case .endocrinology, .nephrology, .hematology, .oncology, .infectiousDiseases, .rheumatology: "cross.case"
        case .gastroenterology: "stomach"
        case .pneumology: "lungs"
        case .otolaryngology, .audiology: "ear"
        case .allergy: "allergens"
        case .pediatrics: "figure.and.child.holdinghands"
        case .nutrition: "fork.knife"
        case .bloodwork: "testtube.2"
        case .xray, .ctScan, .mri, .ultrasound, .mammography: "waveform.path.ecg.rectangle"
        case .gastroscopy, .colonoscopy: "scope"
        case .vaccination: "syringe"
        case .therapy: "pills"
        case .surgery: "cross.case"
        case .equipmentPickup: "shippingbox"
        case .general, .familyMedicine, .other: "stethoscope"
        }
    }

    enum Group: String, CaseIterable, Identifiable {
        case specialist, diagnostic, treatment, logistics
        var id: String { rawValue }
        var label: String {
            switch self {
            case .specialist: "Visite specialistiche"
            case .diagnostic: "Esami e diagnostica"
            case .treatment: "Cure e prevenzione"
            case .logistics: "Ritiri e altro"
            }
        }
    }

    var group: Group {
        switch self {
        case .bloodwork, .xray, .ctScan, .mri, .ultrasound, .mammography, .gastroscopy, .colonoscopy: .diagnostic
        case .vaccination, .therapy, .surgery, .physiotherapy: .treatment
        case .equipmentPickup, .other: .logistics
        default: .specialist
        }
    }
}

struct AppointmentRecord: Codable, Equatable, Identifiable {
    enum Status: String, CaseIterable, Codable, Identifiable {
        case planned
        case awaitingReport
        case completed
        case cancelled

        var id: String { rawValue }

        var label: String {
            switch self {
            case .planned: "Programmato"
            case .awaitingReport: "Referto da ritirare"
            case .completed: "Fatto"
            case .cancelled: "Annullato"
            }
        }
    }

    var id: String = "appointment_\(UUID().uuidString)"
    var title: String
    var scheduledAt: Date
    var category: VisitCategory? = nil
    var recurrenceNote: String?
    var clinician: String?
    var reason: String?
    var outcome: String?
    var linkedDocumentId: String?
    var parentAppointmentId: String? = nil
    var reportCollectionAt: Date? = nil
    var questions: [String]?
    var preparationNotes: String?
    var followUpAt: Date?
    var reminderMinutesBefore: Int?
    var status: Status = .planned
    var createdAt: Date = .now
    var updatedAt: Date = .now

    private enum CodingKeys: String, CodingKey {
        case id, title, scheduledAt, category, recurrenceNote, clinician, reason, outcome,
             linkedDocumentId, parentAppointmentId, reportCollectionAt, questions,
             preparationNotes, followUpAt, reminderMinutesBefore, status, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        scheduledAt = try container.decode(Date.self, forKey: .scheduledAt)
        category = try container.decodeIfPresent(VisitCategory.self, forKey: .category)
        recurrenceNote = try container.decodeIfPresent(String.self, forKey: .recurrenceNote)
        clinician = try container.decodeIfPresent(String.self, forKey: .clinician)
        reason = try container.decodeIfPresent(String.self, forKey: .reason)
        outcome = try container.decodeIfPresent(String.self, forKey: .outcome)
        linkedDocumentId = try container.decodeIfPresent(String.self, forKey: .linkedDocumentId)
        parentAppointmentId = try container.decodeIfPresent(String.self, forKey: .parentAppointmentId)
        reportCollectionAt = try container.decodeIfPresent(Date.self, forKey: .reportCollectionAt)
        questions = try container.decodeIfPresent([String].self, forKey: .questions)
        preparationNotes = try container.decodeIfPresent(String.self, forKey: .preparationNotes)
        followUpAt = try container.decodeIfPresent(Date.self, forKey: .followUpAt)
        reminderMinutesBefore = try container.decodeIfPresent(Int.self, forKey: .reminderMinutesBefore)
        status = try container.decodeIfPresent(Status.self, forKey: .status) ?? .planned
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
    }
}
