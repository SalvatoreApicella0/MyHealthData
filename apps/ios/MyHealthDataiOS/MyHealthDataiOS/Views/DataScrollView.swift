import SwiftUI

private struct MHDEmbeddedDataScrollKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True when a health module is rendered inside the single Dati scroll.
    /// Standalone module screens keep their own vertical scrolling.
    var mhdEmbeddedInDataScroll: Bool {
        get { self[MHDEmbeddedDataScrollKey.self] }
        set { self[MHDEmbeddedDataScrollKey.self] = newValue }
    }
}

/// A module-local vertical scroll when opened on its own, but plain content
/// when embedded in the single Dati scroll. Keeping this decision in the
/// module root avoids leaking `scrollDisabled` into sheets and form controls.
struct MHDDataModuleScrollView<Content: View>: View {
    @Environment(\.mhdEmbeddedInDataScroll) private var isEmbedded
    @ViewBuilder let content: () -> Content

    var body: some View {
        if isEmbedded {
            content()
        } else {
            ScrollView {
                content()
            }
        }
    }
}

struct DataScrollView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("mhd.dataSections.order") private var storedSectionOrder = ""
    @State private var scrollPositionID: String?
    @State private var activeSectionID: String?
    @AppStorage("mhd.dataSections.onlyFavorites") private var showsOnlyFavorites = false
    @State private var favoriteIDs: Set<String> = DataScrollView.loadFavoriteIDs()
    @State private var isDataScrollActive = false
    @State private var selectedMeasurementDetail: MeasurementDetailRequest?

    private static let favoritesDefaultsKey = "mhd.favorites"

    /// Canonical order shared with Web `BASE_SECTIONS`.
    static let defaultSectionFeatures: [HealthFeature] = [
        .body,
        .bodyMeasurements,
        .heart,
        .activity,
        .sleep,
        .nutrition,
        .medications,
        .cycle,
        .gym,
        .bloodwork,
        .allergies,
        .vision,
        .gutHealth,
        .dental,
        .sexualHealth
    ]

    private static let sectionFeatures = defaultSectionFeatures

    private var orderedSectionFeatures: [HealthFeature] {
        let saved = storedSectionOrder
            .split(separator: ",")
            .compactMap { HealthFeature(rawValue: String($0)) }
            .filter { Self.sectionFeatures.contains($0) }
        return saved + Self.sectionFeatures.filter { !saved.contains($0) }
    }

    private var sections: [HealthFeature] {
        guard showsOnlyFavorites else { return orderedSectionFeatures }
        return orderedSectionFeatures.filter { feature in
            feature.measurementTypes.contains { favoriteIDs.contains(Self.measurementFavoriteID(for: $0)) }
        }
    }

    private var activeFeatureID: String? {
        guard let activeSectionID else { return sections.first?.id }
        return sections.first { $0.id == activeSectionID }?.id ?? sections.first?.id
    }

    private var currentFeature: HealthFeature? {
        guard let first = sections.first else { return nil }
        guard let activeSectionID else { return first }
        return sections.first { $0.id == activeSectionID } ?? first
    }

    var body: some View {
        VStack(spacing: 0) {
            stickySectionHeader
            ScrollView {
                if sections.isEmpty {
                    emptyFavoritesState
                } else {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(sections) { feature in
                            HealthFeatureDestinationView(
                                feature: feature,
                                isEmbeddedInDataScroll: true,
                                onlyFavorites: showsOnlyFavorites,
                                favoriteMeasurementIDs: favoriteIDs,
                                onToggleMeasurementFavorite: toggleMeasurementFavorite,
                                onOpenMeasurementDetail: { selectedMeasurementDetail = $0 }
                            )
                                .id("section-\(feature.id)")
                                .clipped()
                        }
                    }
                    .scrollTargetLayout()
                    .padding(.bottom, 32)
                }
            }
            .scrollPosition(id: $scrollPositionID, anchor: .top)
            .onScrollTargetVisibilityChange(idType: String.self, threshold: 0.01) { visibleIDs in
                // Keep display state separate from scrollPosition's bidirectional
                // command/binding state to avoid feedback writes during gestures.
                guard let feature = orderedSectionFeatures.first(where: { visibleIDs.contains("section-\($0.id)") }) else { return }
                if activeSectionID != feature.id { activeSectionID = feature.id }
            }
            .onScrollPhaseChange { _, phase in
                let isScrolling = phase.isScrolling
                guard isScrolling != isDataScrollActive else { return }
                isDataScrollActive = isScrolling
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(item: $selectedMeasurementDetail) { request in
            MeasurementDetailView(
                type: request.type,
                title: request.title,
                symbol: request.symbol,
                tint: request.tint
            )
        }
        .onChange(of: showsOnlyFavorites) { _, _ in
            let first = sections.first
            activeSectionID = first?.id
            scrollPositionID = first.map { "section-\($0.id)" }
        }
        .onAppear {
            if activeSectionID == nil { activeSectionID = sections.first?.id }
            let sanitized = Self.loadFavoriteIDs()
            if sanitized != favoriteIDs { favoriteIDs = sanitized }
            UserDefaults.standard.set(sanitized.sorted(), forKey: Self.favoritesDefaultsKey)
        }
    }

    private var stickySectionHeader: some View {
        HStack(spacing: 8) {
            if let currentFeature {
                Menu {
                    Section("Vai alla sezione") {
                        ForEach(orderedSectionFeatures) { feature in
                            Button {
                                select(feature)
                            } label: {
                                Label(feature.title, systemImage: feature.id == activeFeatureID ? "checkmark" : feature.systemImage)
                            }
                        }
                    }
                    Menu("Riordina sezioni") {
                        ForEach(orderedSectionFeatures) { feature in
                            Menu(feature.title) {
                                Button("Sposta su", systemImage: "arrow.up") { moveSection(feature, by: -1) }
                                    .disabled(orderedSectionFeatures.first == feature)
                                Button("Sposta giù", systemImage: "arrow.down") { moveSection(feature, by: 1) }
                                    .disabled(orderedSectionFeatures.last == feature)
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: currentFeature.systemImage)
                            .font(.subheadline)
                            .foregroundStyle(currentFeature.tint)
                        Text(currentFeature.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.secondary)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, isDataScrollActive ? 9 : 12)
                    .padding(.vertical, isDataScrollActive ? 5 : 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .mhdGlassCapsule(tint: currentFeature.tint.opacity(0.16), interactive: true)
                }
                .menuStyle(.borderlessButton)
                .accessibilityLabel("Sezione corrente: \(currentFeature.title). Tocca per scegliere")
            } else {
                Text("Nessun preferito")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
            }

            favoritesFilterButton
        }
        // Keep the outer height stable: compacting the controls must never
        // resize the scroll viewport and cause a visible jump.
        .frame(height: 46)
        .padding(.horizontal, 16)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: isDataScrollActive)
    }

    private var favoritesFilterButton: some View {
        Button {
            withAnimation(reduceMotion ? nil : .snappy) {
                showsOnlyFavorites.toggle()
            }
        } label: {
            Group {
                if isDataScrollActive {
                    Image(systemName: showsOnlyFavorites ? "star.fill" : "star")
                } else {
                    Label("Preferiti", systemImage: showsOnlyFavorites ? "star.fill" : "star")
                        .labelStyle(.titleAndIcon)
                }
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(showsOnlyFavorites ? Color.mhdWarm : Color.secondary)
            .padding(.horizontal, isDataScrollActive ? 9 : 12)
            .frame(height: 34)
            .mhdGlassCapsule(tint: (showsOnlyFavorites ? Color.mhdWarm : Color.mhdPrimary).opacity(0.16), interactive: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(showsOnlyFavorites ? "Mostra tutte le sezioni" : "Mostra solo i preferiti")
        .accessibilityAddTraits(showsOnlyFavorites ? .isSelected : [])
    }

    private var emptyFavoritesState: some View {
        ContentUnavailableView {
            Label("Nessun preferito", systemImage: "star")
        } description: {
            Text("Tocca la stella su una singola misura per aggiungerla ai preferiti.")
        } actions: {
            Button("Mostra tutte le sezioni") {
                withAnimation(reduceMotion ? nil : .snappy) {
                    showsOnlyFavorites = false
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 48)
    }

    private func select(_ feature: HealthFeature) {
        guard feature.id != activeFeatureID else { return }
        activeSectionID = feature.id
        var transaction = Transaction()
        if reduceMotion { transaction.disablesAnimations = true }
        withTransaction(transaction) { scrollPositionID = "section-\(feature.id)" }
    }

    private func toggleMeasurementFavorite(_ type: MeasurementType) {
        let id = Self.measurementFavoriteID(for: type)
        if favoriteIDs.contains(id) {
            favoriteIDs.remove(id)
        } else {
            favoriteIDs.insert(id)
        }
        UserDefaults.standard.set(favoriteIDs.sorted(), forKey: Self.favoritesDefaultsKey)
    }

    private func moveSection(_ feature: HealthFeature, by offset: Int) {
        guard let source = orderedSectionFeatures.firstIndex(of: feature) else { return }
        let destination = source + offset
        guard orderedSectionFeatures.indices.contains(destination) else { return }
        var order = orderedSectionFeatures
        order.swapAt(source, destination)
        storedSectionOrder = order.map(\.rawValue).joined(separator: ",")
    }

    private static func loadFavoriteIDs() -> Set<String> {
        let stored = UserDefaults.standard.stringArray(forKey: favoritesDefaultsKey) ?? []
        let validMeasurements = Set(sectionFeatures.flatMap { $0.measurementTypes }.map { measurementFavoriteID(for: $0) })
        return Set(stored.filter(validMeasurements.contains))
    }
    fileprivate static func measurementFavoriteID(for type: MeasurementType) -> String { "measurement:\(type.rawValue)" }

}
