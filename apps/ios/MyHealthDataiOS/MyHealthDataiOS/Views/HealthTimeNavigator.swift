import SwiftUI

enum HealthTimeScale: String, CaseIterable, Identifiable {
    case day = "Giorno"
    case week = "Settimana"
    case month = "Mese"
    case year = "Anno"
    case all = "Sempre"

    var id: String { rawValue }
}

enum HealthTimeWindowMode: String, CaseIterable, Identifiable {
    case rolling
    case calendar

    var id: String { rawValue }

    var title: String {
        switch self {
        case .rolling: "Ultimi"
        case .calendar: "Calendario"
        }
    }

}

struct HealthTimeWindow: Equatable {
    var scale: HealthTimeScale
    var anchor: Date
    var mode: HealthTimeWindowMode

    init(scale: HealthTimeScale, anchor: Date, mode: HealthTimeWindowMode = .rolling) {
        self.scale = scale
        self.anchor = anchor
        self.mode = mode
    }

    private var calendar: Calendar { .current }

    var start: Date {
        if mode == .rolling {
            switch scale {
            case .day:
                return calendar.startOfDay(for: anchor)
            case .week:
                return calendar.startOfDay(for: calendar.date(byAdding: .day, value: -6, to: anchor) ?? anchor)
            case .month:
                return calendar.startOfDay(for: calendar.date(byAdding: .day, value: -29, to: anchor) ?? anchor)
            case .year:
                return calendar.startOfDay(for: calendar.date(byAdding: .day, value: -364, to: anchor) ?? anchor)
            case .all:
                return Date.distantPast
            }
        }
        return switch scale {
        case .day:
            calendar.startOfDay(for: anchor)
        case .week:
            calendar.dateInterval(of: .weekOfYear, for: anchor)?.start ?? calendar.startOfDay(for: anchor)
        case .month:
            calendar.dateInterval(of: .month, for: anchor)?.start ?? calendar.startOfDay(for: anchor)
        case .year:
            calendar.dateInterval(of: .year, for: anchor)?.start ?? calendar.startOfDay(for: anchor)
        case .all:
            Date.distantPast
        }
    }

    var end: Date {
        if mode == .rolling {
            guard scale != .all else { return .now }
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: anchor))
            return tomorrow ?? anchor
        }
        let component: Calendar.Component
        switch scale {
        case .day: component = .day
        case .week: component = .weekOfYear
        case .month: component = .month
        case .year: component = .year
        case .all: return .now
        }
        return calendar.date(byAdding: component, value: 1, to: start) ?? start
    }

    var title: String {
        if mode == .rolling {
            switch scale {
            case .day:
                return start.formatted(.dateTime.weekday(.wide).day().month(.wide).year())
            case .week:
                return rollingTitle(days: 7)
            case .month:
                return rollingTitle(days: 30)
            case .year:
                return rollingTitle(days: 365)
            case .all:
                return "Tutti i dati disponibili"
            }
        }
        switch scale {
        case .day:
            return start.formatted(.dateTime.weekday(.wide).day().month(.wide).year())
        case .week:
            let lastDay = calendar.date(byAdding: .day, value: -1, to: end) ?? end
            return formattedRange(from: start, to: lastDay)
        case .month:
            return start.formatted(.dateTime.month(.wide).year())
        case .year:
            return start.formatted(.dateTime.year())
        case .all:
            return "Tutti i dati disponibili"
        }
    }

    func modeLabel(_ mode: HealthTimeWindowMode) -> String {
        switch mode {
        case .rolling:
            return switch scale {
            case .day: "Ultime 24 ore"
            case .week: "Ultimi 7 giorni"
            case .month: "Ultimi 30 giorni"
            case .year: "Ultimi 365 giorni"
            case .all: "Tutti i dati disponibili"
            }
        case .calendar:
            switch scale {
            case .day:
                return "Giorno \(start.formatted(.dateTime.day().month(.abbreviated)))"
            case .week:
                let lastDay = calendar.date(byAdding: .day, value: -1, to: end) ?? end
                return "Settimana \(formattedRange(from: start, to: lastDay))"
            case .month:
                return start.formatted(.dateTime.month(.wide).year())
            case .year:
                return "Anno \(start.formatted(.dateTime.year()))"
            case .all:
                return "Tutti i dati disponibili"
            }
        }
    }

    mutating func move(_ amount: Int) {
        if mode == .rolling {
            let days: Int
            switch scale {
            case .day: days = amount
            case .week: days = amount * 7
            case .month: days = amount * 30
            case .year: days = amount * 365
            case .all: return
            }
            anchor = calendar.date(byAdding: .day, value: days, to: anchor) ?? anchor
            return
        }
        let component: Calendar.Component
        switch scale {
        case .day: component = .day
        case .week: component = .weekOfYear
        case .month: component = .month
        case .year: component = .year
        case .all: return
        }
        anchor = calendar.date(byAdding: component, value: amount, to: anchor) ?? anchor
    }

    private func rollingTitle(days _: Int) -> String {
        let lastDay = calendar.date(byAdding: .day, value: -1, to: end) ?? end
        return formattedRange(from: start, to: lastDay)
    }

    private func formattedRange(from first: Date, to last: Date) -> String {
        let sameYear = calendar.component(.year, from: first) == calendar.component(.year, from: last)
        let sameMonth = sameYear && calendar.component(.month, from: first) == calendar.component(.month, from: last)
        if sameMonth {
            return "\(first.formatted(.dateTime.day()))–\(last.formatted(.dateTime.day().month(.wide).year()))"
        }
        if sameYear {
            return "\(first.formatted(.dateTime.day().month(.abbreviated)))–\(last.formatted(.dateTime.day().month(.abbreviated).year()))"
        }
        return "\(first.formatted(.dateTime.day().month(.abbreviated).year()))–\(last.formatted(.dateTime.day().month(.abbreviated).year()))"
    }
}
