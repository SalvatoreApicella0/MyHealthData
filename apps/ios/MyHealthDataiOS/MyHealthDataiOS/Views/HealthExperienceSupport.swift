import SwiftUI

extension View {
    func medicationInput() -> some View {
        textFieldStyle(.plain)
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(.white.opacity(0.2)))
    }
}

enum ExperiencePalette {
    static let sleep = Color.indigo
    static let medication = Color(red: 0.82, green: 0.38, blue: 0.08)

    static func background(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(.systemBackground) : Color(.systemGroupedBackground)
    }

    static func surface(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? Color(.secondarySystemBackground) : .white
    }
}

struct ExperienceSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.title3.bold())
            content
        }
    }
}

struct ExperienceInlineEmptyState: View {
    @Environment(\.colorScheme) private var colorScheme
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.secondary)
                .frame(width: 38, height: 38)
                .background(Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(14)
        .background(ExperiencePalette.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 8))
    }
}
