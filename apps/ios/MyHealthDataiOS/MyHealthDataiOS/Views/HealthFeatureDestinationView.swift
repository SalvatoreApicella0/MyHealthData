import SwiftUI

struct HealthFeatureDestinationView: View {
    var feature: HealthFeature
    /// The Dati page owns one vertical gesture stream. Module destinations
    /// remain independently scrollable when opened from navigation.
    var isEmbeddedInDataScroll = false
    var onlyFavorites = false
    var favoriteMeasurementIDs: Set<String> = []
    var onToggleMeasurementFavorite: ((MeasurementType) -> Void)?
    var onOpenMeasurementDetail: ((MeasurementDetailRequest) -> Void)?

    @ViewBuilder
    var body: some View {
        Group {
            switch feature {
            case .body:
                BodyPain3DView()
            case .cycle:
                CycleDashboardView()
            case .sexualHealth:
                SexualHealthModuleView()
            case .allergies:
                AllergiesModuleView()
            case .vision:
                VisionModuleView()
            case .gutHealth:
                GutHealthModuleView()
            case .dental:
                DentalHealthModuleView()
            case .sleep:
                EnhancedSleepDashboardView(
                    onlyFavorites: onlyFavorites,
                    favoriteMeasurementIDs: favoriteMeasurementIDs,
                    onToggleMeasurementFavorite: onToggleMeasurementFavorite
                )
            case .heart:
                HealthMetricModuleView(module: .heart, onlyFavorites: onlyFavorites, favoriteIDs: favoriteMeasurementIDs, onToggleFavorite: onToggleMeasurementFavorite, onOpenDetail: onOpenMeasurementDetail)
            case .activity:
                HealthMetricModuleView(module: .activity, onlyFavorites: onlyFavorites, favoriteIDs: favoriteMeasurementIDs, onToggleFavorite: onToggleMeasurementFavorite, onOpenDetail: onOpenMeasurementDetail)
            case .gym:
                GymModuleView()
            case .bodyMeasurements:
                BodyMeasurementsModuleView(
                    onlyFavorites: onlyFavorites,
                    favoriteMeasurementIDs: favoriteMeasurementIDs,
                    onToggleMeasurementFavorite: onToggleMeasurementFavorite,
                    onOpenDetail: onOpenMeasurementDetail
                )
            case .nutrition:
                NutritionModuleView(
                    onlyFavorites: onlyFavorites,
                    favoriteMeasurementIDs: favoriteMeasurementIDs,
                    onToggleMeasurementFavorite: onToggleMeasurementFavorite
                )
            case .medications:
                EnhancedMedicationsDashboardView()
            case .bloodwork:
                EnhancedBloodworkDashboardView()
            case .trends:
                EnhancedTrendsDashboardView()
            case .backupSync:
                EnhancedBackupDashboardView()
            case .shareForCare:
                EnhancedShareDashboardView()
            }
        }
        // The module header is the only title surface inside a module.
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .environment(\.mhdEmbeddedInDataScroll, isEmbeddedInDataScroll)
    }
}
