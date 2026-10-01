import Foundation

/// Keeps a quantitative trend legible by fitting the Y axis to the observed values.
/// Semantic charts such as severity scores and zero-based consumption bars retain their fixed domains.
enum AdaptiveChartDomain {
    static func range(for values: [Double], minimumPadding: Double = 0.5) -> ClosedRange<Double> {
        let finite = values.filter(\.isFinite)
        guard let lower = finite.min(), let upper = finite.max() else { return 0...1 }

        if lower == upper {
            let padding = max(abs(lower) * 0.08, minimumPadding)
            return (lower - padding)...(upper + padding)
        }

        let padding = max((upper - lower) * 0.10, minimumPadding)
        return (lower - padding)...(upper + padding)
    }
}
