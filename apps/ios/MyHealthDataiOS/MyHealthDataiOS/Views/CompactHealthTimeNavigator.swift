import SwiftUI

/// Compact, context-aware time navigation for long scrolling dashboards.
///
/// The current range and step controls stay visible without taking over the
/// scroll surface. Less frequently used choices (scale and window mode) live
/// in a popover that can become a sheet on compact presentations.
struct CompactHealthTimeNavigator: View {
    @Binding var window: HealthTimeWindow
    let tint: Color

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isShowingControls = false

    var body: some View {
        HStack(spacing: 8) {
            Button {
                isShowingControls = true
            } label: {
                HStack(spacing: 9) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(tint)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(window.title)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                        Text(windowSummary)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Intervallo: \(window.title)")
            .accessibilityHint("Apri per cambiare scala e tipo di intervallo")

            if window.scale != .all {
                stepButton(amount: -1, systemName: "chevron.left")
                stepButton(amount: 1, systemName: "chevron.right")
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .mhdGlassPanel(tint: tint.opacity(0.05))
        .popover(isPresented: $isShowingControls, arrowEdge: .top) {
            controlsPopover
        }
        .transaction { transaction in
            if reduceMotion {
                transaction.animation = nil
            }
        }
    }

    private var windowSummary: String {
        if window.scale == .all { return "Tutti i dati" }
        return window.mode == .rolling ? "Finestra mobile" : "Calendario"
    }

    private func stepButton(amount: Int, systemName: String) -> some View {
        Button {
            window.move(amount)
        } label: {
            Image(systemName: systemName)
                .font(.caption.weight(.bold))
                .frame(width: 30, height: 30)
        }
        .buttonStyle(.plain)
        .mhdGlassCircle(tint: tint.opacity(0.12), interactive: true)
        .disabled(amount > 0 && window.end > .now)
        .accessibilityLabel(amount < 0 ? "Intervallo precedente" : "Intervallo successivo")
    }

    private var controlsPopover: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Intervallo dati")
                .font(.headline)

            Picker("Scala temporale", selection: $window.scale) {
                ForEach(HealthTimeScale.allCases) { scale in
                    Text(scale.rawValue).tag(scale)
                }
            }
            .pickerStyle(.menu)
            .accessibilityLabel("Scala temporale")

            if window.scale != .all {
                Picker("Tipo di intervallo", selection: $window.mode) {
                    ForEach(HealthTimeWindowMode.allCases) { mode in
                        Text(window.modeLabel(mode)).tag(mode)
                    }
                }
                .pickerStyle(.menu)
                .accessibilityLabel("Tipo di intervallo temporale")
            }

            Text(window.title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(18)
        .frame(minWidth: 250, alignment: .leading)
        .tint(tint)
        .transaction { transaction in
            if reduceMotion {
                transaction.animation = nil
            }
        }
    }
}
