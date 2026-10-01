import Foundation

enum NutritionMealType: String, CaseIterable, Codable, Identifiable {
    case other
    case breakfast
    case lunch
    case dinner
    case snack
    case morningSnack
    case afternoonSnack
    case eveningSnack

    var id: String { rawValue }

    var title: String {
        if let custom = UserDefaults.standard.string(forKey: "nutrition.mealName.\(rawValue)")?.nilIfBlank {
            return custom
        }
        return switch self {
        case .other: "Non classificati"
        case .breakfast: "Colazione"
        case .lunch: "Pranzo"
        case .dinner: "Cena"
        case .snack: "Spuntini"
        case .morningSnack: "Spuntino mattina"
        case .afternoonSnack: "Spuntino pomeriggio"
        case .eveningSnack: "Dopocena"
        }
    }

    var defaultHour: Int {
        switch self {
        case .other: 12
        case .breakfast: 8
        case .lunch: 13
        case .dinner: 20
        case .snack: 16
        case .morningSnack: 10
        case .afternoonSnack: 17
        case .eveningSnack: 22
        }
    }
}

enum FoodDataSource: String, Codable {
    case manual
    case openFoodFacts = "open_food_facts"
}

struct FoodLogEntry: Codable, Equatable, Identifiable {
    var id: String = "food_\(UUID().uuidString)"
    var name: String
    var brand: String? = nil
    var barcode: String? = nil
    var meal: NutritionMealType
    var loggedAt: Date
    var quantity: Double
    var servingUnit: String
    var servingDescription: String? = nil
    var calories: Double
    var protein: Double? = nil
    var carbohydrates: Double? = nil
    var fat: Double? = nil
    var fiber: Double? = nil
    var sugar: Double? = nil
    var sodiumMilligrams: Double? = nil
    var imageURL: String? = nil
    var source: FoodDataSource = .manual
    var isFavorite: Bool = false
    var createdAt: Date = .now
}

struct FoodRecipeIngredient: Codable, Equatable, Identifiable {
    var id: String = "recipe_ingredient_\(UUID().uuidString)"
    var name: String
    var quantity: Double
    var unit: String = "g"
    var calories: Double
    var protein: Double = 0
    var carbohydrates: Double = 0
    var fat: Double = 0
}

struct FoodRecipe: Codable, Equatable, Identifiable {
    var id: String = "recipe_\(UUID().uuidString)"
    var name: String
    var servings: Double
    var ingredients: [FoodRecipeIngredient]
    var imageData: Data? = nil
    var createdAt: Date = .now

    var caloriesPerServing: Double { ingredients.reduce(0) { $0 + $1.calories } / max(servings, 1) }
    var proteinPerServing: Double { ingredients.reduce(0) { $0 + $1.protein } / max(servings, 1) }
    var carbohydratesPerServing: Double { ingredients.reduce(0) { $0 + $1.carbohydrates } / max(servings, 1) }
    var fatPerServing: Double { ingredients.reduce(0) { $0 + $1.fat } / max(servings, 1) }
}
