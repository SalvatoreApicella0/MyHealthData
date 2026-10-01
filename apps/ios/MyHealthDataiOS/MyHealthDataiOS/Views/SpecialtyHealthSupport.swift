import SwiftUI

extension View {
    func specialtyInput() -> some View {
        self
            .textFieldStyle(.plain)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(.white.opacity(0.22)))
    }
}

extension HealthEvent {
    func tag(_ key: String) -> String? {
        tags.first { $0.hasPrefix("\(key)=") }.map { String($0.dropFirst(key.count + 1)) }
    }
}

struct SpecialtySection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.title2.bold())
            content
        }
    }
}
