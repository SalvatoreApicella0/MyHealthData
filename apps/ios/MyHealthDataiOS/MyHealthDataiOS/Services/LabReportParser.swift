import Foundation

struct ParsedLabResult: Identifiable, Equatable {
    let id = UUID()
    var isSelected = true
    var analyte: String
    var value: Double
    var unit: String
    var referenceRange: String?
    var referenceLow: Double?
    var referenceHigh: Double?
    var flag: String?
}

struct LabReportParser {
    private static let expression: NSRegularExpression = {
        do {
            return try NSRegularExpression(
                pattern: #"^(.{2,60}?)\s+([<>]?\s*\d+(?:[\.,]\d+)?)\s+([A-Za-zµμ%/\d\^\.\-]+)(?:\s+([<>]?\s*\d+(?:[\.,]\d+)?\s*(?:-|–|—|a)\s*\d+(?:[\.,]\d+)?))?(?:\s+([*HLhl]+))?$"#,
                options: [.caseInsensitive]
            )
        } catch {
            preconditionFailure("LabReportParser regex is invalid: \(error)")
        }
    }()

    func parse(_ text: String) -> [ParsedLabResult] {
        var results: [ParsedLabResult] = []
        var seen = Set<String>()

        for rawLine in text.components(separatedBy: .newlines) {
            let line = rawLine.replacingOccurrences(of: "\t", with: " ")
                .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard line.count >= 5 else { continue }
            let range = NSRange(line.startIndex..., in: line)
            guard let match = Self.expression.firstMatch(in: line, range: range), match.numberOfRanges >= 4,
                  let analyte = capture(1, match, line)?.trimmingCharacters(in: .whitespaces),
                  isPlausibleAnalyte(analyte),
                  let valueText = capture(2, match, line), let value = decimal(valueText),
                  let unit = capture(3, match, line), isPlausibleUnit(unit) else { continue }

            let reference = capture(4, match, line)
            let bounds = reference.flatMap(referenceBounds)
            let explicitFlag = capture(5, match, line)
            let inferredFlag: String? = {
                guard let bounds else { return explicitFlag }
                if value < bounds.0 { return "Basso" }
                if value > bounds.1 { return "Alto" }
                return explicitFlag
            }()
            let key = "\(analyte.lowercased())|\(value)|\(unit.lowercased())"
            guard seen.insert(key).inserted else { continue }
            results.append(ParsedLabResult(
                analyte: analyte,
                value: value,
                unit: unit,
                referenceRange: reference,
                referenceLow: bounds?.0,
                referenceHigh: bounds?.1,
                flag: inferredFlag
            ))
        }
        return results
    }

    private func capture(_ index: Int, _ match: NSTextCheckingResult, _ source: String) -> String? {
        let range = match.range(at: index)
        guard range.location != NSNotFound, let swiftRange = Range(range, in: source) else { return nil }
        return String(source[swiftRange])
    }

    private func decimal(_ value: String) -> Double? {
        Double(value.replacingOccurrences(of: "<", with: "").replacingOccurrences(of: ">", with: "").replacingOccurrences(of: " ", with: "").replacingOccurrences(of: ",", with: "."))
    }

    private func referenceBounds(_ value: String) -> (Double, Double)? {
        let numbers = value.components(separatedBy: CharacterSet(charactersIn: "0123456789,.").inverted).compactMap(decimal)
        guard numbers.count >= 2 else { return nil }
        return (numbers[0], numbers[1])
    }

    private func isPlausibleAnalyte(_ value: String) -> Bool {
        value.rangeOfCharacter(from: .letters) != nil && !value.lowercased().contains("pagina")
    }

    private func isPlausibleUnit(_ value: String) -> Bool {
        value.rangeOfCharacter(from: .letters) != nil || value.contains("%")
    }
}
