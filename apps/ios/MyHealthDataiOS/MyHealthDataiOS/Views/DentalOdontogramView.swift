import SwiftUI

/// Compact, deterministic FDI board shared by the dental module.
///
/// The board deliberately favors stable quadrants and readable identifiers over
/// a decorative tooth illustration. This keeps the interaction predictable on
/// small screens and makes VoiceOver navigation match the visual order.
struct DentalOdontogramView: View {
    let projection: DentalContract.Projection
    let upper: [String]
    let lower: [String]
    let selectedTooth: String?
    let onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Odontogramma")
                    .font(.headline)
                Spacer(minLength: 8)
                Text("FDI · vista frontale")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text("Tocca un dente per vedere lo stato e l’ultimo intervento.")
                .font(.caption)
                .foregroundStyle(.secondary)

            archRow(
                title: "Arcata superiore",
                quadrants: [Array(upper.prefix(8)), Array(upper.suffix(8))],
                labels: ["Q1 · destra", "Q2 · sinistra"]
            )

            Divider()

            archRow(
                title: "Arcata inferiore",
                quadrants: [Array(lower.prefix(8)), Array(lower.suffix(8))],
                labels: ["Q4 · destra", "Q3 · sinistra"]
            )

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 112), spacing: 8)], alignment: .leading, spacing: 6) {
                ForEach(DentalToothState.legend) { state in
                    Label(state.title, systemImage: state.symbol)
                        .font(.caption)
                        .foregroundStyle(state.color)
                }
            }
        }
        .padding(12)
        .mhdGlassPanel(tint: Color.cyan.opacity(0.05))
    }

    private func archRow(title: String, quadrants: [[String]], labels: [String]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            HStack(alignment: .top, spacing: 6) {
                quadrant(labels[0], teeth: quadrants[0])
                Rectangle()
                    .fill(.quaternary)
                    .frame(width: 1)
                    .padding(.vertical, 4)
                quadrant(labels[1], teeth: quadrants[1])
            }
        }
    }

    private func quadrant(_ label: String, teeth: [String]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
                .textCase(.uppercase)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(minimum: 26), spacing: 4), count: 4), spacing: 4) {
                ForEach(teeth, id: \.self) { tooth in
                    toothCell(tooth)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(7)
        .background(.quaternary.opacity(0.26), in: RoundedRectangle(cornerRadius: 10))
    }

    private func toothCell(_ tooth: String) -> some View {
        let toothProjection = projection.byTooth[tooth]
        let event = toothProjection?.latestEvent
        let state = DentalToothState(rawValue: toothProjection?.state?.rawValue ?? "") ?? .unrecorded
        let isSelected = selectedTooth == tooth
        let symbol = state == .unrecorded ? "minus" : state.symbol

        return Button {
            onSelect(tooth)
        } label: {
            VStack(spacing: 2) {
                Image(systemName: symbol)
                    .font(.system(size: 10, weight: .semibold))
                Text(tooth)
                    .font(.caption.weight(.semibold).monospacedDigit())
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .foregroundStyle(state.color)
            .background(
                state.color.opacity(state.isRemoved ? 0.14 : isSelected ? 0.20 : 0.08),
                in: RoundedRectangle(cornerRadius: 8)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.primary : state.color.opacity(0.34), lineWidth: isSelected ? 1.5 : 0.75)
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Dente FDI \(tooth)")
        .accessibilityValue(([state.title, event.map { DentalIntervention.from($0).title }].compactMap { $0 }).joined(separator: ", "))
        .accessibilityHint("Tocca per vedere lo stato e lo storico.")
    }
}
