import SwiftUI

struct EnhancedVisitRow: View {
    let visit: AppointmentRecord
    let onComplete: () -> Void
    let onReschedule: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                Image(systemName: visit.category?.symbol ?? "stethoscope")
                    .font(.headline)
                    .foregroundStyle(.blue)
                    .frame(width: 40, height: 40)
                    .background(Color.blue.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 3) {
                    if let category = visit.category {
                        Text(category.label.uppercased())
                            .font(.caption2.bold())
                            .foregroundStyle(.blue)
                    }
                    Text(visit.reason ?? visit.title)
                        .font(.headline)
                    Text(visit.scheduledAt.formatted(date: .complete, time: .shortened))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 10)
                Menu {
                    Button("Sposta visita", systemImage: "calendar.badge.clock", action: onReschedule)
                    Button("Segna completata", systemImage: "checkmark.circle", action: onComplete)
                    Button("Annulla visita", systemImage: "xmark.circle", role: .destructive, action: onCancel)
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title3)
                        .frame(width: 32, height: 32)
                }
                .accessibilityLabel("Azioni visita")
            }

            if let clinician = visit.clinician {
                Label(clinician, systemImage: "person.text.rectangle")
                    .font(.subheadline)
            }
            if let preparation = visit.preparationNotes {
                VisitDetailBlock(title: "Preparazione", text: preparation, icon: "checklist")
            }
            if let questions = visit.questions, !questions.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("Domande", systemImage: "questionmark.bubble")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(Array(questions.enumerated()), id: \.offset) { index, question in
                        Text("\(index + 1). \(question)")
                            .font(.subheadline)
                    }
                }
            }
            if let followUpAt = visit.followUpAt {
                Label("Follow-up: \(followUpAt.formatted(date: .abbreviated, time: .shortened))", systemImage: "arrow.forward.circle")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.blue)
            }

            HStack(spacing: 10) {
                Button("Sposta", systemImage: "calendar.badge.clock", action: onReschedule)
                    .buttonStyle(.bordered)
                Button("Completata", systemImage: "checkmark", action: onComplete)
                    .buttonStyle(.borderedProminent)
                    .tint(.blue)
                Button("Annulla", action: onCancel)
                    .buttonStyle(.bordered)
            }
            .font(.subheadline.weight(.semibold))
        }
        .padding(14)
        .mhdGlassPanel(tint: Color.blue.opacity(0.05))
    }
}
private struct VisitDetailBlock: View {
    let title: String
    let text: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(title, systemImage: icon)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            Text(text)
                .font(.subheadline)
        }
    }
}

struct VisitHistoryRow: View {
    let visit: AppointmentRecord

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: visit.category?.symbol ?? statusSymbol)
                .foregroundStyle(statusTint)
                .font(.title3)
                .frame(width: 38, height: 38)
                .background(statusTint.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                if let category = visit.category {
                    Text(category.label)
                        .font(.caption.bold())
                        .foregroundStyle(statusTint)
                }
                Text(visit.reason ?? visit.title)
                    .font(.headline)
                Text(visit.scheduledAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let outcome = visit.outcome {
                    Text(outcome).font(.subheadline).lineLimit(3)
                }
                if visit.linkedDocumentId != nil {
                    Label("Referto collegato", systemImage: "doc.text.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(.blue)
                }
            }
            Spacer()
            Text(visit.status.label)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .mhdGlassPanel()
    }

    private var statusTint: Color {
        switch visit.status {
        case .completed: .green
        case .awaitingReport: .orange
        case .cancelled: .secondary
        case .planned: .blue
        }
    }

    private var statusSymbol: String {
        switch visit.status {
        case .completed: "checkmark.circle.fill"
        case .awaitingReport: "doc.badge.clock"
        case .cancelled: "xmark.circle.fill"
        case .planned: "calendar"
        }
    }
}

struct FollowUpRow: View {
    let visit: AppointmentRecord

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundStyle(.orange)
                .frame(width: 38, height: 38)
                .background(.orange.opacity(0.13), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(visit.reason ?? visit.title).font(.headline)
                Text("Da prenotare dal \(visit.followUpAt?.formatted(date: .abbreviated, time: .omitted) ?? "")")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
        }
        .padding(12)
        .mhdGlassPanel(tint: .orange.opacity(0.05))
    }
}
