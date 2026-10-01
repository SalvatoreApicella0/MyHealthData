import SwiftUI

@main
struct MyHealthDataApp: App {
    @State private var store = HealthDataStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .task {
                    await Task.detached {
                        LocalVaultStore().cleanupTemporaryFiles()
                    }.value
                    await store.load()
                    await store.importDocumentsFromShareExtension()
                    await store.syncPersonalRelay()
                    store.syncHub()
                    HealthHistorySyncService.shared.startIfNeeded(store: store)
#if !targetEnvironment(macCatalyst)
                    HealthHistorySyncService.shared.startObservingHealthKit(store: store)
                    HealthHistorySyncService.shared.registerBackgroundRefresh(store: store)
#endif
                }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                HealthHistorySyncService.shared.startIfNeeded(store: store)
#if !targetEnvironment(macCatalyst)
                HealthHistorySyncService.shared.startObservingHealthKit(store: store)
#endif
                Task {
                    await store.importDocumentsFromShareExtension()
                    await store.syncPersonalRelay()
                    store.syncHub()
                }
            case .background:
                HealthHistorySyncService.shared.cancel()
                Task { await store.flushPersistence() }
            default:
                break
            }
        }
    }
}
