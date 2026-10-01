import SwiftUI

enum MHDPalette {
    static let aqua = Color(red: 0.00, green: 0.68, blue: 0.72)
    static let mint = Color(red: 0.18, green: 0.78, blue: 0.58)
    static let iris = Color(red: 0.38, green: 0.38, blue: 0.92)
    static let coral = Color(red: 0.98, green: 0.31, blue: 0.43)
    static let sun = Color(red: 1.00, green: 0.67, blue: 0.12)
}

struct MHDModuleHeader: View {
    let title: String
    let subtitle: String
    let symbol: String
    let tint: Color

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol).font(.title2.bold()).foregroundStyle(tint)
                .frame(width: 50, height: 50).mhdGlassCircle(tint: tint.opacity(0.10))
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.largeTitle.bold())
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

private struct MHDGlassCapsuleModifier: ViewModifier {
    var tint: Color?
    var interactive: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, macCatalyst 26.0, *) {
            if interactive {
                content.glassEffect(.regular.tint(tint ?? .clear).interactive(), in: .capsule)
            } else {
                content.glassEffect(.regular.tint(tint ?? .clear), in: .capsule)
            }
        } else {
            content
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke(.white.opacity(0.18), lineWidth: 0.75))
        }
    }
}

private struct MHDGlassCircleModifier: ViewModifier {
    var tint: Color?
    var interactive: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, macCatalyst 26.0, *) {
            if interactive {
                content.glassEffect(.regular.tint(tint ?? .clear).interactive(), in: .circle)
            } else {
                content.glassEffect(.regular.tint(tint ?? .clear), in: .circle)
            }
        } else {
            content
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().stroke(.white.opacity(0.18), lineWidth: 0.75))
        }
    }
}

private struct MHDGlassPanelModifier: ViewModifier {
    var tint: Color?

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, macCatalyst 26.0, *) {
            content.glassEffect(.regular.tint(tint ?? .clear), in: .rect(cornerRadius: 28))
        } else {
            content
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .stroke(.white.opacity(0.14), lineWidth: 0.75)
                )
        }
    }
}

extension View {
    func mhdGlassCapsule(tint: Color? = nil, interactive: Bool = false) -> some View {
        modifier(MHDGlassCapsuleModifier(tint: tint, interactive: interactive))
    }

    func mhdGlassCircle(tint: Color? = nil, interactive: Bool = false) -> some View {
        modifier(MHDGlassCircleModifier(tint: tint, interactive: interactive))
    }

    func mhdGlassPanel(tint: Color? = nil) -> some View {
        modifier(MHDGlassPanelModifier(tint: tint))
    }

    @ViewBuilder
    func mhdGlassButton(prominent: Bool = false) -> some View {
        if #available(iOS 26.0, macCatalyst 26.0, *) {
            if prominent {
                self.buttonStyle(.glassProminent).buttonBorderShape(.capsule)
            } else {
                self.buttonStyle(.glass).buttonBorderShape(.capsule)
            }
        } else if prominent {
            self.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
        } else {
            self.buttonStyle(.bordered).buttonBorderShape(.capsule)
        }
    }
}
