import SwiftUI

struct MedicationExperienceCard: View {
    @Environment(\.colorScheme) private var colorScheme
    var medication: MedicationStatement
    var onLog: (MedicationDoseEvent.Status) -> Void
    var onStatusChange: (MedicationStatement.Status) -> Void
    var onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "pills.fill")
                    .font(.title3)
                    .foregroundStyle(ExperiencePalette.medication)
                    .frame(width: 40, height: 40)
                    .background(ExperiencePalette.medication.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 3) {
                    Text(medication.name).font(.headline)
                    if !medication.dose.isEmpty {
                        Text(medication.dose).font(.subheadline).foregroundStyle(.secondary)
                    }
                    Label(scheduleText, systemImage: scheduleIcon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(ExperiencePalette.medication)
                }
                Spacer()
                Menu {
                    Button("Modifica terapia", systemImage: "pencil", action: onEdit)
                    Button("Metti in pausa") { onStatusChange(.paused) }
                    Button("Segna interrotta") { onStatusChange(.stopped) }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title3)
                }
                .accessibilityLabel("Azioni per \(medication.name)")
            }

            HStack(spacing: 8) {
                doseButton("Presa", icon: "checkmark", status: .taken, tint: .green)
                doseButton("Saltata", icon: "xmark", status: .skipped, tint: .red)
                doseButton("Posticipata", icon: "clock", status: .postponed, tint: .orange)
            }
        }
        .padding(14)
        .mhdGlassPanel(tint: ExperiencePalette.medication.opacity(0.06))
    }

    private var scheduleText: String {
        switch medication.scheduleStyle {
        case .fixedTimes:
            let labels = (medication.scheduledTimes ?? []).sorted {
                ($0.hour, $0.minute) < ($1.hour, $1.minute)
            }.map(\.label)
            return labels.isEmpty ? fallbackSchedule : labels.joined(separator: ", ")
        case .interval:
            return medication.intervalHours.map { "Ogni \($0) ore" } ?? fallbackSchedule
        case .asNeeded:
            return "Al bisogno"
        case nil:
            return fallbackSchedule
        }
    }

    private var fallbackSchedule: String {
        medication.schedule.nilIfBlank ?? "Orario non indicato"
    }

    private var scheduleIcon: String {
        switch medication.scheduleStyle {
        case .interval: "repeat"
        case .asNeeded: "hand.raised.fill"
        default: "clock.fill"
        }
    }

    private func doseButton(_ title: String, icon: String, status: MedicationDoseEvent.Status, tint: Color) -> some View {
        Button { onLog(status) } label: {
            Label(title, systemImage: icon)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity, minHeight: 34)
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .tint(tint)
    }
}
struct MedicationStockRow: View {
    @Environment(\.colorScheme) private var colorScheme
    var medication: MedicationStatement

    private var needsRefill: Bool {
        guard let stock = medication.stockQuantity, let threshold = medication.refillThreshold else { return false }
        return stock <= threshold
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: needsRefill ? "exclamationmark.triangle.fill" : "shippingbox.fill")
                .foregroundStyle(needsRefill ? Color.orange : Color.green)
                .frame(width: 36, height: 36)
                .background((needsRefill ? Color.orange : Color.green).opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(medication.name).font(.subheadline.weight(.semibold))
                if let threshold = medication.refillThreshold {
                    Text("Avviso a \(quantityText(threshold))")
                        .font(.caption).foregroundStyle(.secondary)
                } else {
                    Text("Avviso non impostato").font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(quantityText(medication.stockQuantity ?? 0)).font(.headline)
                Text(needsRefill ? "Da rifornire" : "disponibili")
                    .font(.caption.weight(needsRefill ? .semibold : .regular))
                    .foregroundStyle(needsRefill ? .orange : .secondary)
            }
        }
        .padding(12)
        .mhdGlassPanel()
    }

    private func quantityText(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(value.rounded() == value ? 0 : 1)))
    }
}

struct MedicationDoseExperienceRow: View {
    var event: MedicationDoseEvent
    var medicationName: String

    private var tint: Color {
        switch event.status {
        case .taken: .green
        case .skipped: .red
        case .postponed: .orange
        }
    }

    private var icon: String {
        switch event.status {
        case .taken: "checkmark.circle.fill"
        case .skipped: "xmark.circle.fill"
        case .postponed: "clock.fill"
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon).foregroundStyle(tint).frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(medicationName).font(.subheadline.weight(.semibold))
                Text(event.status.label).font(.caption).foregroundStyle(tint)
            }
            Spacer()
            Text(event.recordedAt.formatted(.dateTime.day().month(.abbreviated).hour().minute().locale(Locale(identifier: "it_IT"))))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 11)
    }
}

struct MedicationEmptyState: View {
    var action: () -> Void

    var body: some View {
        ContentUnavailableView {
            Label("Nessuna terapia attiva", systemImage: "pills")
        } description: {
            Text("Aggiungi una terapia per ritrovare programma, dosi e scorte in un solo posto.")
        } actions: {
            Button("Aggiungi terapia", action: action)
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
        }
        .frame(maxWidth: .infinity, minHeight: 250)
    }
}
