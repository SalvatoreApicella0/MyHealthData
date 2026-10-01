import SwiftUI

/// Shared presentation and accessibility contract for metric-level favorites.
/// The raw type is deliberately persisted exactly as the Web contract uses it.
struct MHDMetricFavoriteButton: View {
    let type: MeasurementType
    let tint: Color
    let isFavorite: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            Image(systemName: isFavorite ? "star.fill" : "star")
                .frame(width: 32, height: 32)
        }
        .buttonStyle(.plain)
        .foregroundStyle(isFavorite ? Color.mhdWarm : Color.secondary)
        .mhdGlassCircle(tint: tint.opacity(0.10), interactive: true)
        .accessibilityLabel(favoriteLabel)
        .accessibilityHint("Usa lo stesso preferito anche nella versione Web.")
        .accessibilityAddTraits(isFavorite ? .isSelected : [])
    }

    private var favoriteLabel: String {
        let action = isFavorite ? "Rimuovi" : "Aggiungi"
        return "\(action) \(type.label) \(isFavorite ? "dai" : "ai") preferiti"
    }
}

struct HealthFeatureTile: View {
    var feature: HealthFeature
    var style: HealthModuleCardStyle

    var body: some View {
        Group {
            if style == .photography {
                photographyCard
            } else {
                nativeGlassCard
            }
        }
        .frame(height: 146)
        .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityHint(feature.subtitle)
    }

    private var photographyCard: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottomLeading) {
                Image(feature.cardImageName)
                    .resizable()
                    .scaledToFill()
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .clipped()

                LinearGradient(
                    colors: [.clear, .black.opacity(0.12), .black.opacity(0.76)],
                    startPoint: .top,
                    endPoint: .bottom
                )

                tileLabel(foreground: .white, shadow: true)
                    .padding(14)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(.white.opacity(0.22), lineWidth: 0.8))
        .shadow(color: .black.opacity(0.12), radius: 10, y: 5)
    }

    @ViewBuilder private var nativeGlassCard: some View {
        let content = VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                Image(systemName: feature.systemImage)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(feature.tint)
                    .frame(width: 42, height: 42)
                    .background(feature.tint.opacity(0.13), in: Circle())
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                    .padding(.top, 5)
            }
            Spacer(minLength: 0)
            Text(feature.title)
                .font(.headline.weight(.bold))
                .foregroundStyle(.primary)
                .lineLimit(2)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

        if #available(iOS 26.0, *) {
            content
                .glassEffect(
                    .regular.tint(feature.tint.opacity(0.14)).interactive(),
                    in: .rect(cornerRadius: 22)
                )
        } else {
            content
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
    }

    private func tileLabel(foreground: Color, shadow: Bool) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            Text(feature.title)
                .font(.headline.weight(.bold))
                .foregroundStyle(foreground)
                .lineLimit(2)
                .shadow(color: shadow ? .black.opacity(0.35) : .clear, radius: 3, y: 1)
            Spacer(minLength: 4)
            Image(systemName: "chevron.right")
                .font(.caption.bold())
                .foregroundStyle(foreground.opacity(0.9))
        }
    }
}
