import Foundation

struct CycleDateRange: Equatable {
    var start: Date
    var end: Date

    func contains(_ date: Date, calendar: Calendar = .current) -> Bool {
        let day = calendar.startOfDay(for: date)
        return day >= calendar.startOfDay(for: start) && day <= calendar.startOfDay(for: end)
    }
}

enum CyclePhase: String {
    case menstrual
    case follicular
    case fertile
    case luteal

    var title: String {
        switch self {
        case .menstrual: "Mestruazioni"
        case .follicular: "Fase follicolare"
        case .fertile: "Finestra fertile stimata"
        case .luteal: "Fase luteale"
        }
    }

    var shortTitle: String {
        switch self {
        case .menstrual: "Ciclo"
        case .follicular: "Follicolare"
        case .fertile: "Fertile"
        case .luteal: "Luteale"
        }
    }
}

struct CycleForecast {
    let calendar: Calendar
    let today: Date
    let latestRecordedStart: Date
    let currentCycleStart: Date
    let nextPeriodStart: Date
    let nextPeriodEnd: Date
    let upcomingFertileWindow: CycleDateRange
    let upcomingOvulationDate: Date
    let cycleLength: Int
    let periodLength: Int
    let currentCycleDay: Int
    let periodDelayDays: Int
    let predictionMethod: CyclePredictionMethod
    let usedTypicalFallback: Bool
    let periodStarts: [Date]
    let historicalCycleLengths: [Int]
    let entries: [CycleEntry]

    var averageTrackedCycleLength: Int? {
        guard !historicalCycleLengths.isEmpty else { return nil }
        return Int((Double(historicalCycleLengths.reduce(0, +)) / Double(historicalCycleLengths.count)).rounded())
    }

    var cycleVariation: Int? {
        guard let minimum = historicalCycleLengths.min(), let maximum = historicalCycleLengths.max() else { return nil }
        return maximum - minimum
    }

    var methodDescription: String {
        if usedTypicalFallback {
            return "Durata abituale, finche non registri due inizi consecutivi"
        }
        return predictionMethod == .lastCycle ? "Durata dell'ultimo ciclo" : "Durata abituale"
    }

    var isPeriodOverdue: Bool {
        periodDelayDays > 0
    }

    func phase(on date: Date) -> CyclePhase {
        if isLoggedPeriodDay(date) || isPredictedPeriodDay(date) {
            return .menstrual
        }
        if isEstimatedFertileDay(date) {
            return .fertile
        }

        let start = cycleStart(containing: date)
        let ovulation = calendar.date(byAdding: .day, value: cycleLength - 14, to: start) ?? start
        return calendar.startOfDay(for: date) > ovulation ? .luteal : .follicular
    }

    func isLoggedPeriodDay(_ date: Date) -> Bool {
        let day = calendar.startOfDay(for: date)
        if entries.contains(where: { calendar.isDate($0.date, inSameDayAs: day) && $0.recordsPeriod }) {
            return true
        }

        for startEntry in entries.filter(\.isPeriodStart) {
            let start = calendar.startOfDay(for: startEntry.date)
            guard day >= start else { continue }
            let maximumEnd = calendar.date(byAdding: .day, value: 14, to: start) ?? start
            guard day <= maximumEnd else { continue }
            if let endEntry = entries
                .filter({ $0.isPeriodEnd && $0.date >= start && $0.date <= maximumEnd })
                .min(by: { $0.date < $1.date }),
               day <= calendar.startOfDay(for: endEntry.date) {
                return true
            }
        }
        return false
    }

    func isPredictedPeriodDay(_ date: Date) -> Bool {
        guard !isLoggedPeriodDay(date) else { return false }
        let day = calendar.startOfDay(for: date)
        let start = cycleStart(containing: day)
        let offset = calendar.dateComponents([.day], from: start, to: day).day ?? 0
        return offset >= 0 && offset < periodLength
    }

    func isEstimatedFertileDay(_ date: Date) -> Bool {
        let day = calendar.startOfDay(for: date)
        let start = cycleStart(containing: day)
        let ovulation = calendar.date(byAdding: .day, value: cycleLength - 14, to: start) ?? start
        let fertileStart = calendar.date(byAdding: .day, value: -5, to: ovulation) ?? ovulation
        return day >= fertileStart && day <= ovulation
    }

    func isEstimatedOvulationDay(_ date: Date) -> Bool {
        let day = calendar.startOfDay(for: date)
        let start = cycleStart(containing: day)
        let ovulation = calendar.date(byAdding: .day, value: cycleLength - 14, to: start) ?? start
        return calendar.isDate(day, inSameDayAs: ovulation)
    }

    func cycleStart(containing date: Date) -> Date {
        let day = calendar.startOfDay(for: date)
        let delta = calendar.dateComponents([.day], from: latestRecordedStart, to: day).day ?? 0
        let cycleIndex = Int(floor(Double(delta) / Double(cycleLength)))
        return calendar.date(byAdding: .day, value: cycleIndex * cycleLength, to: latestRecordedStart)
            ?? latestRecordedStart
    }

    func recordedPeriodLength(startingAt start: Date) -> Int? {
        let normalizedStart = calendar.startOfDay(for: start)
        let maximumEnd = calendar.date(byAdding: .day, value: 14, to: normalizedStart) ?? normalizedStart
        let periodEntries = entries.filter {
            let day = calendar.startOfDay(for: $0.date)
            return $0.recordsPeriod && day >= normalizedStart && day <= maximumEnd
        }
        guard !periodEntries.isEmpty else { return nil }
        let lastDate = periodEntries.map { calendar.startOfDay(for: $0.date) }.max() ?? normalizedStart
        return (calendar.dateComponents([.day], from: normalizedStart, to: lastDate).day ?? 0) + 1
    }
}

enum CyclePredictor {
    static func forecast(
        entries: [CycleEntry],
        settings: CycleSettings,
        calendar inputCalendar: Calendar = .current,
        now: Date = .now
    ) -> CycleForecast? {
        var calendar = inputCalendar
        if calendar.timeZone.secondsFromGMT(for: now) == 0 && inputCalendar == Calendar(identifier: .gregorian) {
            calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        }
        let today = calendar.startOfDay(for: now)
        let periodStarts = normalizedPeriodStarts(entries: entries, calendar: calendar)
            .filter { $0 <= today }
        guard let latestStart = periodStarts.last else { return nil }

        let historicalLengths = zip(periodStarts, periodStarts.dropFirst()).compactMap { older, newer -> Int? in
            let days = calendar.dateComponents([.day], from: older, to: newer).day ?? 0
            return CycleSettings.allowedCycleLength.contains(days) ? days : nil
        }

        let typicalLength = min(
            max(settings.typicalCycleLength, CycleSettings.allowedCycleLength.lowerBound),
            CycleSettings.allowedCycleLength.upperBound
        )
        let lastLength = historicalLengths.last
        let usesFallback = settings.predictionMethod == .lastCycle && lastLength == nil
        let cycleLength = settings.predictionMethod == .lastCycle ? (lastLength ?? typicalLength) : typicalLength
        let periodLength = min(max(settings.typicalPeriodLength, 1), min(cycleLength, 15))

        let elapsedDays = max(calendar.dateComponents([.day], from: latestStart, to: today).day ?? 0, 0)
        let firstExpectedStart = calendar.date(byAdding: .day, value: cycleLength, to: latestStart) ?? latestStart
        let daysPastFirstPrediction = calendar.dateComponents(
            [.day],
            from: firstExpectedStart,
            to: today
        ).day ?? 0
        let keepsCurrentPrediction = daysPastFirstPrediction <= 14
        let currentStart: Date
        let nextStart: Date
        let cycleDay: Int
        let periodDelayDays: Int

        if keepsCurrentPrediction {
            currentStart = latestStart
            nextStart = firstExpectedStart
            cycleDay = elapsedDays + 1
            periodDelayDays = max(daysPastFirstPrediction, 0)
        } else {
            let elapsedCycles = elapsedDays / cycleLength
            currentStart = calendar.date(byAdding: .day, value: elapsedCycles * cycleLength, to: latestStart)
                ?? latestStart
            let isBoundaryToday = calendar.isDate(currentStart, inSameDayAs: today)
            let isCurrentStartRecorded = periodStarts.contains { calendar.isDate($0, inSameDayAs: currentStart) }
            if isBoundaryToday && !isCurrentStartRecorded {
                nextStart = currentStart
            } else {
                nextStart = calendar.date(byAdding: .day, value: cycleLength, to: currentStart) ?? currentStart
            }
            cycleDay = max((calendar.dateComponents([.day], from: currentStart, to: today).day ?? 0) + 1, 1)
            periodDelayDays = 0
        }
        let nextEnd = calendar.date(byAdding: .day, value: periodLength - 1, to: nextStart) ?? nextStart

        let currentOvulation = calendar.date(byAdding: .day, value: cycleLength - 14, to: currentStart) ?? currentStart
        let currentFertileStart = calendar.date(byAdding: .day, value: -5, to: currentOvulation) ?? currentOvulation
        let fertileCycleStart: Date
        if currentOvulation >= today {
            fertileCycleStart = currentStart
        } else {
            fertileCycleStart = calendar.date(byAdding: .day, value: cycleLength, to: currentStart) ?? currentStart
        }
        let upcomingOvulation = calendar.date(byAdding: .day, value: cycleLength - 14, to: fertileCycleStart)
            ?? currentOvulation
        let upcomingFertileStart = calendar.date(byAdding: .day, value: -5, to: upcomingOvulation)
            ?? currentFertileStart
        return CycleForecast(
            calendar: calendar,
            today: today,
            latestRecordedStart: latestStart,
            currentCycleStart: currentStart,
            nextPeriodStart: nextStart,
            nextPeriodEnd: nextEnd,
            upcomingFertileWindow: CycleDateRange(start: upcomingFertileStart, end: upcomingOvulation),
            upcomingOvulationDate: upcomingOvulation,
            cycleLength: cycleLength,
            periodLength: periodLength,
            currentCycleDay: cycleDay,
            periodDelayDays: periodDelayDays,
            predictionMethod: settings.predictionMethod,
            usedTypicalFallback: usesFallback,
            periodStarts: periodStarts,
            historicalCycleLengths: historicalLengths,
            entries: entries
        )
    }

    static func normalizedPeriodStarts(entries: [CycleEntry], calendar: Calendar = .current) -> [Date] {
        let explicit = entries
            .filter(\.isPeriodStart)
            .map { calendar.startOfDay(for: $0.date) }
        let candidates: [Date]

        if explicit.isEmpty {
            let periodDays = entries
                .filter(\.recordsPeriod)
                .map { calendar.startOfDay(for: $0.date) }
                .sorted()
            var inferred: [Date] = []
            for day in periodDays {
                guard let previous = inferred.last else {
                    inferred.append(day)
                    continue
                }
                let gap = calendar.dateComponents([.day], from: previous, to: day).day ?? 0
                if gap > 14 {
                    inferred.append(day)
                }
            }
            candidates = inferred
        } else {
            candidates = explicit
        }

        return Array(Set(candidates)).sorted()
    }
}
