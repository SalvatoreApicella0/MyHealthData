import SwiftUI

struct GymSummaryTile: View {
    let title: String
    let value: String
    let symbol: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Label(title, systemImage: symbol)
                .font(.caption)
                .foregroundStyle(.orange)
            Text(value)
                .font(.title2.bold())
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .mhdGlassPanel(tint: .orange.opacity(0.05))
    }
}
struct MuscleSetSummary: View {
    let values: [(name: String, count: Int)]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Fasce muscolari allenate")
                .font(.headline)
            ForEach(values, id: \.name) { item in
                HStack {
                    Text(item.name.capitalized)
                    Spacer()
                    Text("\(item.count) serie")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.orange)
                }
            }
        }
        .padding(16)
        .mhdGlassPanel(tint: .orange.opacity(0.06))
    }
}
