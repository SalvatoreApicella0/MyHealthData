import SwiftUI

extension String {
    var nilIfBlankForDashboard: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

extension VisitCategory {
    var documentModuleLink: String? {
        switch self {
        case .ophthalmology: DocumentModuleLink.vision.rawValue
        case .dentistry: DocumentModuleLink.dental.rawValue
        case .bloodwork: nil
        case .cardiology: DocumentModuleLink.heart.rawValue
        case .gynecology: DocumentModuleLink.cycle.rawValue
        case .therapy: DocumentModuleLink.medications.rawValue
        default: nil
        }
    }
}

extension Date {
    var roundedToQuarterHour: Date {
        let calendar = Calendar.current
        let minute = calendar.component(.minute, from: self)
        let delta = ((minute + 7) / 15) * 15 - minute
        return calendar.date(byAdding: .minute, value: delta, to: self) ?? self
    }
}

extension View {
    func mhdInputField() -> some View {
        padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            }
    }
}

extension AppointmentRecord {
    init(
        id: String = "appointment_\(UUID().uuidString)",
        title: String,
        scheduledAt: Date,
        category: VisitCategory? = nil,
        recurrenceNote: String? = nil,
        clinician: String? = nil,
        reason: String? = nil,
        outcome: String? = nil,
        linkedDocumentId: String? = nil,
        parentAppointmentId: String? = nil,
        reportCollectionAt: Date? = nil,
        questions: [String]? = nil,
        preparationNotes: String? = nil,
        followUpAt: Date? = nil,
        reminderMinutesBefore: Int? = nil,
        status: AppointmentRecord.Status = .planned,
        createdAt: Date = .now,
        updatedAt: Date = .now
    ) {
        self.id = id
        self.title = title
        self.scheduledAt = scheduledAt
        self.category = category
        self.recurrenceNote = recurrenceNote
        self.clinician = clinician
        self.reason = reason
        self.outcome = outcome
        self.linkedDocumentId = linkedDocumentId
        self.parentAppointmentId = parentAppointmentId
        self.reportCollectionAt = reportCollectionAt
        self.questions = questions
        self.preparationNotes = preparationNotes
        self.followUpAt = followUpAt
        self.reminderMinutesBefore = reminderMinutesBefore
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}


struct VisitsConditionSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.title3.bold())
            content
        }
    }
}

struct VisitsConditionEmptyState: View {
    let title: String
    let icon: String
    let detail: String

    var body: some View {
        ContentUnavailableView(title, systemImage: icon, description: Text(detail))
            .frame(maxWidth: .infinity, minHeight: 140)
    }
}

struct VisitStatusChange {
    let visit: AppointmentRecord
    let status: AppointmentRecord.Status
}
