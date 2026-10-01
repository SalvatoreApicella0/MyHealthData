import PhotosUI
import SwiftUI

struct RecipeLibraryView: View {
    @Environment(HealthDataStore.self) private var store
    let meal: NutritionMealType
    let date: Date
    let tint: Color
    let onSaved: () -> Void
    @State private var isCreating = false
    @State private var selectedRecipe: FoodRecipe?
    @State private var editingRecipe: FoodRecipe?

    private var sortedRecipes: [FoodRecipe] {
        store.snapshot.foodRecipes.sorted { $0.createdAt > $1.createdAt }
    }

    var body: some View {
        Group {
            if store.snapshot.foodRecipes.isEmpty {
                ContentUnavailableView {
                    Label("Nessuna ricetta", systemImage: "book.pages")
                } description: {
                    Text("Componi una ricetta una volta e aggiungila ai pasti in pochi secondi.")
                } actions: {
                    Button("Crea ricetta", systemImage: "plus") { isCreating = true }.mhdGlassButton(prominent: true)
                }
            } else {
                List {
                    ForEach(sortedRecipes) { recipe in
                        Button { selectedRecipe = recipe } label: {
                            HStack(spacing: 12) {
                                RecipeImage(data: recipe.imageData, size: 44, tint: tint)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(recipe.name).font(.headline)
                                    Text("\(recipe.caloriesPerServing.formatted(.number.precision(.fractionLength(0)))) kcal · \(recipe.ingredients.count) ingredienti")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button("Modifica", systemImage: "pencil") { editingRecipe = recipe }
                        }
                    }
                    .onDelete { offsets in
                        offsets.forEach { store.deleteFoodRecipe(id: sortedRecipes[$0].id) }
                    }
                }.listStyle(.plain)
            }
        }
        .toolbar { ToolbarItem(placement: .primaryAction) { Button("Nuova ricetta", systemImage: "plus") { isCreating = true } } }
        .sheet(isPresented: $isCreating) { NavigationStack { RecipeEditorView(tint: tint) } }
        .sheet(item: $editingRecipe) { recipe in NavigationStack { RecipeEditorView(tint: tint, recipe: recipe) } }
        .sheet(item: $selectedRecipe) { recipe in
            NavigationStack { RecipeServingView(recipe: recipe, meal: meal, date: date, tint: tint, onSaved: onSaved) }
        }
    }
}

private struct RecipeEditorView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let tint: Color
    let recipe: FoodRecipe?
    @State private var name = ""
    @State private var servings = 2.0
    @State private var ingredients: [FoodRecipeIngredient] = []
    @State private var ingredientQuery = ""
    @State private var ingredientResults: [FoodProduct] = []
    @State private var isSearching = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var imageData: Data?

    init(tint: Color, recipe: FoodRecipe? = nil) {
        self.tint = tint
        self.recipe = recipe
        _name = State(initialValue: recipe?.name ?? "")
        _servings = State(initialValue: recipe?.servings ?? 2)
        _ingredients = State(initialValue: recipe?.ingredients ?? [])
        _imageData = State(initialValue: recipe?.imageData)
    }

    var body: some View {
        let hasImage = imageData != nil
        Form {
            Section("Ricetta") {
                TextField("Nome della ricetta", text: $name)
                Stepper("\(servings.formatted(.number.precision(.fractionLength(0)))) porzioni", value: $servings, in: 1...20)
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label(hasImage ? "Cambia foto" : "Aggiungi foto", systemImage: "camera.fill")
                }
                if let imageData { RecipeImage(data: imageData, size: 110, tint: tint).frame(maxWidth: .infinity) }
            }
            Section("Ingredienti") {
                ForEach(ingredients) { ingredient in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(ingredient.name).font(.headline)
                        HStack {
                            TextField("Grammi", value: quantityBinding(for: ingredient.id), format: .number)
                                .keyboardType(.decimalPad)
                                .textFieldStyle(.roundedBorder)
                            Text(ingredient.unit).foregroundStyle(.secondary)
                            Text("\(ingredient.calories.formatted(.number.precision(.fractionLength(0)))) kcal")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Text("Proteine \(ingredient.protein.formatted(.number.precision(.fractionLength(0...1)))) g · Carboidrati \(ingredient.carbohydrates.formatted(.number.precision(.fractionLength(0...1)))) g · Grassi \(ingredient.fat.formatted(.number.precision(.fractionLength(0...1)))) g")
                            .font(.caption2).foregroundStyle(.secondary)
                    }.padding(.vertical, 4)
                }.onDelete { ingredients.remove(atOffsets: $0) }

                HStack {
                    TextField("Cerca albume, avena…", text: $ingredientQuery).onSubmit { Task { await searchIngredients() } }
                    Button("Cerca", systemImage: "magnifyingglass") { Task { await searchIngredients() } }.labelStyle(.iconOnly)
                }
                if isSearching { ProgressView() }
                ForEach(ingredientResults.prefix(6)) { product in
                    Button { addIngredient(product) } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(product.name).foregroundStyle(.primary)
                                Text("\(product.caloriesPer100g.formatted(.number.precision(.fractionLength(0)))) kcal / 100 g")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer(); Image(systemName: "plus.circle.fill").foregroundStyle(tint)
                        }
                    }.buttonStyle(.plain)
                }
            }
        }
        .navigationTitle(recipe == nil ? "Nuova ricetta" : "Modifica ricetta")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva") {
                    var saved = recipe ?? FoodRecipe(name: name, servings: servings, ingredients: [])
                    saved.name = name
                    saved.servings = servings
                    saved.ingredients = ingredients.filter { $0.name.nilIfBlank != nil }
                    saved.imageData = imageData
                    store.saveFoodRecipe(saved)
                    dismiss()
                }.disabled(name.nilIfBlank == nil || ingredients.allSatisfy { $0.name.nilIfBlank == nil })
            }
        }
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else { return }
                imageData = image.jpegData(compressionQuality: 0.72)
            }
        }
    }

    @MainActor private func searchIngredients() async {
        isSearching = true
        ingredientResults = (try? await OpenFoodFactsService.shared.search(ingredientQuery)) ?? []
        isSearching = false
    }

    private func addIngredient(_ product: FoodProduct) {
        ingredients.append(FoodRecipeIngredient(
            name: product.name, quantity: 100, calories: product.caloriesPer100g,
            protein: product.proteinPer100g ?? 0, carbohydrates: product.carbohydratesPer100g ?? 0,
            fat: product.fatPer100g ?? 0
        ))
        ingredientQuery = ""
        ingredientResults = []
    }

    private func quantityBinding(for id: String) -> Binding<Double> {
        Binding {
            ingredients.first(where: { $0.id == id })?.quantity ?? 0
        } set: { newQuantity in
            guard let index = ingredients.firstIndex(where: { $0.id == id }) else { return }
            let oldQuantity = max(ingredients[index].quantity, 0.0001)
            let factor = max(newQuantity, 0) / oldQuantity
            ingredients[index].quantity = max(newQuantity, 0)
            ingredients[index].calories *= factor
            ingredients[index].protein *= factor
            ingredients[index].carbohydrates *= factor
            ingredients[index].fat *= factor
        }
    }
}

private struct RecipeServingView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let recipe: FoodRecipe
    let meal: NutritionMealType
    let date: Date
    let tint: Color
    let onSaved: () -> Void
    @State private var portions = 1.0

    var body: some View {
        VStack(spacing: 24) {
            RecipeImage(data: recipe.imageData, size: 92, tint: tint)
            Text(recipe.name).font(.largeTitle.bold()).multilineTextAlignment(.center)
            Stepper("\(portions.formatted(.number.precision(.fractionLength(0...1)))) porzioni", value: $portions, in: 0.5...10, step: 0.5)
                .padding().mhdGlassCapsule(tint: tint.opacity(0.06))
            Text("\((recipe.caloriesPerServing * portions).formatted(.number.precision(.fractionLength(0)))) kcal")
                .font(.title.bold().monospacedDigit())
            Button("Aggiungi a \(meal.title.lowercased())", systemImage: "checkmark") { save() }.mhdGlassButton(prominent: true)
            Spacer()
        }.padding(24)
        .navigationTitle("Ricetta").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Indietro") { dismiss() } } }
    }

    private func save() {
        store.addFoodLogEntry(FoodLogEntry(
            name: recipe.name, meal: meal,
            loggedAt: Calendar.current.date(bySettingHour: meal.defaultHour, minute: 0, second: 0, of: date) ?? date,
            quantity: portions, servingUnit: "porzioni", calories: recipe.caloriesPerServing * portions,
            protein: recipe.proteinPerServing * portions, carbohydrates: recipe.carbohydratesPerServing * portions,
            fat: recipe.fatPerServing * portions
        ))
        onSaved()
    }
}

private struct RecipeImage: View {
    let data: Data?
    let size: CGFloat
    let tint: Color
    var body: some View {
        Group {
            if let data, let image = UIImage(data: data) {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                Image(systemName: "book.pages.fill").font(.title2).foregroundStyle(tint)
            }
        }
        .frame(width: size, height: size)
        .background(tint.opacity(0.10), in: Circle()).clipShape(Circle())
    }
}
