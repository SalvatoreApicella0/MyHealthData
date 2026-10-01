import PhotosUI
import SwiftUI
#if !targetEnvironment(macCatalyst)
import VisionKit
#endif

struct FoodProductRow: View {
    let product: FoodProduct

    var body: some View {
        HStack(spacing: 13) {
            FoodProductImage(url: product.imageURL, size: 52)
            VStack(alignment: .leading, spacing: 3) {
                Text(product.name).font(.headline).lineLimit(2)
                if let brand = product.brand { Text(brand).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                Text("\(product.caloriesPer100g.formatted(.number.precision(.fractionLength(0)))) kcal · 100 g")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.green)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 5)
    }
}

struct FoodProductImage: View {
    let url: String?
    let size: CGFloat

    var body: some View {
        AsyncImage(url: url.flatMap(URL.init(string:))) { image in
            image.resizable().scaledToFit()
        } placeholder: {
            Image(systemName: "fork.knife").foregroundStyle(.secondary)
        }
        .frame(width: size, height: size)
        .padding(4)
        .background(.quaternary, in: Circle())
        .clipShape(Circle())
    }
}

struct FoodThumbnail: View {
    let entry: FoodLogEntry
    let size: CGFloat

    var body: some View {
        FoodProductImage(url: entry.imageURL, size: size)
    }
}

struct FoodPickerView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case search = "Cerca"
        case recipes = "Ricette"
        case custom = "Manuale"
        var id: String { rawValue }
    }

    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let meal: NutritionMealType
    let date: Date
    let tint: Color

    @State private var mode: Mode = .search
    @State private var query = ""
    @State private var barcode = ""
    @State private var results: [FoodProduct] = []
    @State private var selectedProduct: FoodProduct?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isShowingScanner = false

    var body: some View {
        VStack(spacing: 14) {
            Picker("Modalità", selection: $mode) {
                ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)

            switch mode {
            case .search: searchContent
            case .recipes: RecipeLibraryView(meal: meal, date: date, tint: tint, onSaved: { dismiss() })
            case .custom: CustomFoodView(meal: meal, date: date, tint: tint, onSaved: { dismiss() })
            }

            if mode == .search {
                Link("Dati alimentari: Open Food Facts", destination: URL(string: "https://world.openfoodfacts.org")!)
                    .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            }
        }
        .navigationTitle(meal.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Chiudi") { dismiss() } } }
        .sheet(item: $selectedProduct) { product in
            NavigationStack {
                FoodPortionView(product: product, meal: meal, date: date, tint: tint) { dismiss() }
            }
        }
        #if !targetEnvironment(macCatalyst)
        .fullScreenCover(isPresented: $isShowingScanner) {
            FoodBarcodeScanner { code in
                barcode = code
                isShowingScanner = false
                Task { await lookupBarcode() }
            } onCancel: {
                isShowingScanner = false
            }
        }
        #endif
    }

    private var searchContent: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                TextField("Cerca alimento o marca", text: $query)
                    .textFieldStyle(.plain)
                    .submitLabel(.search)
                    .onSubmit { Task { await search() } }
                    .padding(.horizontal, 17).frame(height: 48)
                    .mhdGlassCapsule(interactive: true)
                Button { Task { await search() } } label: {
                    Image(systemName: "magnifyingglass").frame(width: 46, height: 46)
                }
                .buttonStyle(.plain).mhdGlassCircle(tint: tint.opacity(0.15), interactive: true)
                .disabled(query.trimmingCharacters(in: .whitespaces).count < 2 || isLoading)
                Button {
                    #if !targetEnvironment(macCatalyst)
                    isShowingScanner = true
                    #else
                    Task { await search() }
                    #endif
                } label: {
                    Image(systemName: "barcode.viewfinder").frame(width: 46, height: 46)
                }
                .buttonStyle(.plain).mhdGlassCircle(interactive: true)
            }.padding(.horizontal)

            resultList(emptyTitle: "Cerca nel catalogo", emptyMessage: "Scrivi almeno due caratteri e avvia la ricerca.")
        }
    }

    private func resultList(emptyTitle: String, emptyMessage: String) -> some View {
        Group {
            if isLoading {
                ProgressView("Ricerca nel catalogo...").frame(maxHeight: .infinity)
            } else if let errorMessage {
                ContentUnavailableView("Ricerca non riuscita", systemImage: "wifi.exclamationmark", description: Text(errorMessage))
            } else if results.isEmpty {
                ContentUnavailableView(emptyTitle, systemImage: "fork.knife.circle", description: Text(emptyMessage))
            } else {
                List(results) { product in
                    Button { selectedProduct = product } label: {
                        FoodProductRow(product: product)
                    }.buttonStyle(.plain)
                }.listStyle(.plain)
            }
        }
    }

    @MainActor private func search() async {
        isLoading = true; errorMessage = nil
        let digits = query.filter(\.isNumber)
        do {
            if digits.count >= 8 && digits.count == query.trimmingCharacters(in: .whitespaces).count {
                results = try await OpenFoodFactsService.shared.product(barcode: digits).map { [$0] } ?? []
            } else {
                results = try await OpenFoodFactsService.shared.search(query)
            }
        }
        catch { errorMessage = foodSearchErrorMessage(error) }
        isLoading = false
    }

    @MainActor private func lookupBarcode() async {
        isLoading = true; errorMessage = nil
        do {
            if let product = try await OpenFoodFactsService.shared.product(barcode: barcode) {
                results = [product]; selectedProduct = product
            } else { errorMessage = "Prodotto non presente. Puoi aggiungerlo manualmente." }
        } catch { errorMessage = foodSearchErrorMessage(error) }
        isLoading = false
    }

    private func foodSearchErrorMessage(_ error: Error) -> String {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost:
                return "Il dispositivo non risulta connesso a Internet."
            case .timedOut:
                return "Open Food Facts non ha risposto in tempo. Riprova."
            case .appTransportSecurityRequiresSecureConnection:
                return "La connessione sicura è stata bloccata dal sistema."
            default:
                return "Errore di rete (\(urlError.code.rawValue)): \(urlError.localizedDescription)"
            }
        }
        return error.localizedDescription
    }
}

private struct FoodPortionView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let product: FoodProduct
    let meal: NutritionMealType
    let date: Date
    let tint: Color
    let onSaved: () -> Void

    @State private var quantity = 100.0

    private var factor: Double { quantity / 100 }

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                FoodProductImage(url: product.imageURL, size: 104)
                VStack(spacing: 4) {
                    Text(product.name).font(.title2.bold()).multilineTextAlignment(.center)
                    if let brand = product.brand { Text(brand).foregroundStyle(.secondary) }
                }
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    TextField("100", value: $quantity, format: .number)
                        .font(.system(size: 46, weight: .bold, design: .rounded))
                        .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(maxWidth: 180)
                    Text("g").font(.title3.weight(.semibold)).foregroundStyle(.secondary)
                }
                .padding(.horizontal, 24).padding(.vertical, 16)
                .mhdGlassCapsule(tint: tint.opacity(0.08), interactive: true)

                HStack(spacing: 10) {
                    nutrient("kcal", product.caloriesPer100g * factor, .green)
                    nutrient("proteine", (product.proteinPer100g ?? 0) * factor, .blue)
                    nutrient("carbo", (product.carbohydratesPer100g ?? 0) * factor, .orange)
                    nutrient("grassi", (product.fatPer100g ?? 0) * factor, .pink)
                }
                Button("Aggiungi a \(meal.title.lowercased())", systemImage: "checkmark") { save() }
                    .mhdGlassButton(prominent: true).disabled(quantity <= 0)
            }
            .padding(24).frame(maxWidth: 620).frame(maxWidth: .infinity)
        }
        .navigationTitle("Porzione").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Indietro") { dismiss() } } }
    }

    private func nutrient(_ label: String, _ value: Double, _ color: Color) -> some View {
        VStack(spacing: 3) {
            Text(value.formatted(.number.precision(.fractionLength(0...1)))).font(.headline.monospacedDigit())
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity).padding(.vertical, 12).mhdGlassCapsule(tint: color.opacity(0.08))
    }

    private func save() {
        let loggedAt = Calendar.current.date(bySettingHour: meal.defaultHour, minute: 0, second: 0, of: date) ?? date
        store.addFoodLogEntry(FoodLogEntry(
            name: product.name, brand: product.brand, barcode: product.barcode, meal: meal, loggedAt: loggedAt,
            quantity: quantity, servingUnit: "g", servingDescription: product.servingDescription,
            calories: product.caloriesPer100g * factor, protein: product.proteinPer100g.map { $0 * factor },
            carbohydrates: product.carbohydratesPer100g.map { $0 * factor }, fat: product.fatPer100g.map { $0 * factor },
            fiber: product.fiberPer100g.map { $0 * factor }, sugar: product.sugarPer100g.map { $0 * factor },
            sodiumMilligrams: product.sodiumMilligramsPer100g.map { $0 * factor }, imageURL: product.imageURL,
            source: .openFoodFacts
        ))
        onSaved()
    }
}

private struct CustomFoodView: View {
    @Environment(HealthDataStore.self) private var store
    let meal: NutritionMealType
    let date: Date
    let tint: Color
    let onSaved: () -> Void

    @State private var name = ""
    @State private var brand = ""
    @State private var quantity = 100.0
    @State private var calories = 0.0
    @State private var protein = 0.0
    @State private var carbohydrates = 0.0
    @State private var fat = 0.0

    var body: some View {
        Form {
            Section("Alimento") {
                TextField("Nome", text: $name)
                TextField("Marca, facoltativa", text: $brand)
            }
            Section("Porzione") {
                LabeledContent("Grammi") { TextField("100", value: $quantity, format: .number).multilineTextAlignment(.trailing) }
            }
            Section("Valori della porzione") {
                numeric("Calorie", value: $calories, unit: "kcal")
                numeric("Proteine", value: $protein, unit: "g")
                numeric("Carboidrati", value: $carbohydrates, unit: "g")
                numeric("Grassi", value: $fat, unit: "g")
            }
            Button("Aggiungi alimento", systemImage: "checkmark") { save() }
                .mhdGlassButton(prominent: true)
                .disabled(name.nilIfBlank == nil || quantity <= 0 || calories <= 0)
        }
    }

    private func numeric(_ title: String, value: Binding<Double>, unit: String) -> some View {
        LabeledContent(title) {
            HStack { TextField("0", value: value, format: .number).multilineTextAlignment(.trailing); Text(unit).foregroundStyle(.secondary) }
        }
    }

    private func save() {
        store.addFoodLogEntry(FoodLogEntry(
            name: name, brand: brand.nilIfBlank, meal: meal,
            loggedAt: Calendar.current.date(bySettingHour: meal.defaultHour, minute: 0, second: 0, of: date) ?? date,
            quantity: quantity, servingUnit: "g", calories: calories,
            protein: protein, carbohydrates: carbohydrates, fat: fat
        ))
        onSaved()
    }
}


#if !targetEnvironment(macCatalyst)
struct FoodBarcodeScanner: UIViewControllerRepresentable {
    let onCode: (String) -> Void
    let onCancel: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIViewController(context: Context) -> UINavigationController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode()],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: true,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        let navigation = UINavigationController(rootViewController: scanner)
        scanner.navigationItem.title = "Inquadra il barcode"
        scanner.navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Chiudi",
            style: .plain,
            target: context.coordinator,
            action: #selector(Coordinator.cancel)
        )
        try? scanner.startScanning()
        return navigation
    }

    func updateUIViewController(_ uiViewController: UINavigationController, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let parent: FoodBarcodeScanner
        init(parent: FoodBarcodeScanner) { self.parent = parent }

        @objc func cancel() { parent.onCancel() }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didTapOn item: RecognizedItem
        ) {
            guard case let .barcode(barcode) = item,
                  let payload = barcode.payloadStringValue else { return }
            dataScanner.stopScanning()
            parent.onCode(payload)
        }
    }
}
#endif
