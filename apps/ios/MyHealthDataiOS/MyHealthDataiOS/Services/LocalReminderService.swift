import Foundation
import UserNotifications

@MainActor
final class LocalReminderService {
    static let shared = LocalReminderService()

    private let center = UNUserNotificationCenter.current()

    private init() {}

    func scheduleAppointment(_ appointment: AppointmentRecord) {
        cancelAppointment(id: appointment.id)
        guard let minutes = appointment.reminderMinutesBefore,
              let fireDate = Calendar.current.date(byAdding: .minute, value: -minutes, to: appointment.scheduledAt),
              fireDate > .now else { return }

        Task {
            guard await authorizationGranted() else { return }
            let content = neutralContent()
            let components = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: fireDate
            )
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            try? await center.add(
                UNNotificationRequest(
                    identifier: appointmentIdentifier(appointment.id),
                    content: content,
                    trigger: trigger
                )
            )
        }
    }

    func scheduleMedication(_ medication: MedicationStatement) {
        cancelMedication(id: medication.id)
        guard medication.remindersEnabled == true, medication.status == .active else { return }

        Task {
            guard await authorizationGranted() else { return }
            switch medication.scheduleStyle {
            case .fixedTimes:
                for time in medication.scheduledTimes ?? [] {
                    var components = DateComponents()
                    components.hour = time.hour
                    components.minute = time.minute
                    let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
                    try? await center.add(
                        UNNotificationRequest(
                            identifier: medicationIdentifier(medication.id, suffix: time.id),
                            content: neutralContent(),
                            trigger: trigger
                        )
                    )
                }
            case .interval:
                guard let hours = medication.intervalHours else { return }
                let trigger = UNTimeIntervalNotificationTrigger(
                    timeInterval: TimeInterval(max(hours, 1) * 3600),
                    repeats: true
                )
                try? await center.add(
                    UNNotificationRequest(
                        identifier: medicationIdentifier(medication.id, suffix: "interval"),
                        content: neutralContent(),
                        trigger: trigger
                    )
                )
            case .asNeeded, nil:
                break
            }
        }
    }

    func cancelAppointment(id: String) {
        center.removePendingNotificationRequests(withIdentifiers: [appointmentIdentifier(id)])
    }

    func cancelMedication(id: String) {
        let prefix = "mhd.medication.\(id)."
        center.getPendingNotificationRequests { requests in
            let identifiers = requests.map(\.identifier).filter { $0.hasPrefix(prefix) }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: identifiers)
        }
    }

    private func authorizationGranted() async -> Bool {
        do {
            let settings = await center.notificationSettings()
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                return true
            case .notDetermined:
                return try await center.requestAuthorization(options: [.alert, .sound])
            case .denied:
                return false
            @unknown default:
                return false
            }
        } catch {
            return false
        }
    }

    private func neutralContent() -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = "Promemoria MyHealthData"
        content.body = "Hai un’attività salute programmata."
        content.sound = .default
        return content
    }

    private func appointmentIdentifier(_ id: String) -> String { "mhd.appointment.\(id)" }
    private func medicationIdentifier(_ id: String, suffix: String) -> String { "mhd.medication.\(id).\(suffix)" }
}
