import Foundation

extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

extension Date {
    /// Relative time with the same bands used by the Web app:
    /// ora / N min fa / N h fa / N g fa / N a M g fa.
    func mhdRelativeDescription(to reference: Date = .now, calendar: Calendar = .current) -> String {
        let seconds = reference.timeIntervalSince(self)
        if seconds < 60 { return "ora" }
        let minutes = Int(seconds / 60)
        if minutes < 60 { return "\(minutes) min fa" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours) h fa" }
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: self),
            to: calendar.startOfDay(for: reference)
        ).day ?? 0
        if days < 365 { return "\(max(days, 1)) g fa" }
        let years = days / 365
        let remainingDays = days % 365
        return remainingDays == 0 ? "\(years) a fa" : "\(years) a \(remainingDays) g fa"
    }
}
