import Foundation

struct FoodProduct: Identifiable, Hashable, Sendable {
    var id: String { barcode ?? "\(name)|\(brand ?? "")" }
    var name: String
    var brand: String?
    var barcode: String?
    var servingDescription: String?
    var caloriesPer100g: Double
    var proteinPer100g: Double?
    var carbohydratesPer100g: Double?
    var fatPer100g: Double?
    var fiberPer100g: Double?
    var sugarPer100g: Double?
    var sodiumMilligramsPer100g: Double?
    var imageURL: String?
}

actor OpenFoodFactsService {
    static let shared = OpenFoodFactsService()

    private let decoder = JSONDecoder()
    private var searchCache: [String: [FoodProduct]] = [:]
    private var barcodeCache: [String: FoodProduct] = [:]

    func search(_ rawQuery: String) async throws -> [FoodProduct] {
        let query = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= 2 else { return [] }
        let cacheKey = query.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        if let cached = searchCache[cacheKey] { return cached }
        let localMatches = Self.localCatalog.filter { product in
            [product.name, product.brand ?? ""].contains { value in
                value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current).contains(cacheKey)
            }
        }

        var components = URLComponents(string: "https://world.openfoodfacts.org/cgi/search.pl")!
        components.queryItems = [
            URLQueryItem(name: "action", value: "process"),
            URLQueryItem(name: "search_terms", value: query),
            URLQueryItem(name: "search_simple", value: "1"),
            URLQueryItem(name: "json", value: "1"),
            URLQueryItem(name: "page_size", value: "25"),
            URLQueryItem(name: "lc", value: "it"),
            URLQueryItem(name: "cc", value: "it"),
            URLQueryItem(name: "fields", value: Self.responseFields)
        ]
        let remoteProducts: [FoodProduct]
        do {
            let response: SearchResponse = try await request(components.url!)
            remoteProducts = response.products.compactMap(\.foodProduct)
        } catch {
            guard !localMatches.isEmpty else { throw error }
            remoteProducts = []
        }
        var seen = Set<String>()
        let products = (localMatches + remoteProducts).filter { seen.insert($0.id).inserted }
        searchCache[cacheKey] = products
        products.forEach { product in
            if let barcode = product.barcode { barcodeCache[barcode] = product }
        }
        return products
    }

    func product(barcode: String) async throws -> FoodProduct? {
        let normalized = barcode.filter(\.isNumber)
        guard !normalized.isEmpty else { return nil }
        if let cached = barcodeCache[normalized] { return cached }

        var components = URLComponents(string: "https://world.openfoodfacts.org/api/v3/product/\(normalized)")!
        components.queryItems = [
            URLQueryItem(name: "fields", value: Self.responseFields),
            URLQueryItem(name: "lc", value: "it"),
            URLQueryItem(name: "cc", value: "it")
        ]
        let response: ProductResponse = try await request(components.url!)
        guard let product = response.product?.foodProduct else { return nil }
        barcodeCache[normalized] = product
        return product
    }

    private func request<Response: Decodable>(_ url: URL) async throws -> Response {
        var request = URLRequest(url: url)
        request.setValue("MyHealthData/1.0 (org.myhealthdata.ios)", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            throw URLError(.badServerResponse)
        }
        return try decoder.decode(Response.self, from: data)
    }

    private static let responseFields = [
        "code", "product_name", "product_name_it", "brands", "serving_size",
        "image_front_small_url", "nutriments"
    ].joined(separator: ",")

    private static let localCatalog: [FoodProduct] = [
        local("Albume d'uovo", 43, 10.7, 0.7, 0.2),
        local("Uovo intero", 143, 12.6, 0.7, 9.5),
        local("Farina d'avena", 389, 16.9, 66.3, 6.9, fiber: 10.6),
        local("Fiocchi d'avena", 379, 13.2, 67.7, 6.5, fiber: 10.1),
        local("Farina di grano tenero 00", 364, 10.3, 76.3, 1.0, fiber: 2.7),
        local("Latte intero", 61, 3.2, 4.8, 3.3),
        local("Latte parzialmente scremato", 46, 3.3, 4.9, 1.6),
        local("Yogurt greco 0%", 59, 10.3, 3.6, 0.4),
        local("Yogurt bianco intero", 61, 3.5, 4.7, 3.3),
        local("Banana", 89, 1.1, 22.8, 0.3, fiber: 2.6),
        local("Mela", 52, 0.3, 13.8, 0.2, fiber: 2.4),
        local("Riso basmati cotto", 121, 3.5, 25.2, 0.4),
        local("Pasta di semola cotta", 158, 5.8, 30.9, 0.9, fiber: 1.8),
        local("Pane integrale", 247, 13.0, 41.0, 3.4, fiber: 7.0),
        local("Petto di pollo cotto", 165, 31.0, 0, 3.6),
        local("Tonno al naturale sgocciolato", 116, 25.5, 0, 0.8),
        local("Salmone cotto", 206, 22.1, 0, 12.4),
        local("Lenticchie cotte", 116, 9.0, 20.1, 0.4, fiber: 7.9),
        local("Ceci cotti", 164, 8.9, 27.4, 2.6, fiber: 7.6),
        local("Olio extravergine di oliva", 884, 0, 0, 100),
        local("Parmigiano Reggiano", 402, 32.4, 0, 29.7),
        local("Mozzarella", 280, 28.0, 3.1, 17.0),
        local("Patate bollite", 87, 1.9, 20.1, 0.1, fiber: 1.8),
        local("Broccoli cotti", 35, 2.4, 7.2, 0.4, fiber: 3.3)
    ]

    private static func local(
        _ name: String, _ calories: Double, _ protein: Double, _ carbohydrates: Double,
        _ fat: Double, fiber: Double? = nil
    ) -> FoodProduct {
        FoodProduct(
            name: name, brand: "Catalogo base", barcode: nil, servingDescription: "100 g",
            caloriesPer100g: calories, proteinPer100g: protein,
            carbohydratesPer100g: carbohydrates, fatPer100g: fat,
            fiberPer100g: fiber, sugarPer100g: nil, sodiumMilligramsPer100g: nil, imageURL: nil
        )
    }
}

private struct SearchResponse: Decodable {
    var products: [OpenFoodFactsProduct]
}

private struct ProductResponse: Decodable {
    var product: OpenFoodFactsProduct?
}

private struct OpenFoodFactsProduct: Decodable {
    var code: String?
    var productName: String?
    var productNameIT: String?
    var brands: String?
    var servingSize: String?
    var imageFrontSmallURL: String?
    var nutriments: Nutriments?

    enum CodingKeys: String, CodingKey {
        case code, brands, nutriments
        case productName = "product_name"
        case productNameIT = "product_name_it"
        case servingSize = "serving_size"
        case imageFrontSmallURL = "image_front_small_url"
    }

    var foodProduct: FoodProduct? {
        guard let name = productNameIT?.nilIfBlank ?? productName?.nilIfBlank,
              let calories = nutriments?.energyKcal100g, calories > 0 else { return nil }
        return FoodProduct(
            name: name,
            brand: brands?.nilIfBlank,
            barcode: code,
            servingDescription: servingSize?.nilIfBlank,
            caloriesPer100g: calories,
            proteinPer100g: nutriments?.proteins100g,
            carbohydratesPer100g: nutriments?.carbohydrates100g,
            fatPer100g: nutriments?.fat100g,
            fiberPer100g: nutriments?.fiber100g,
            sugarPer100g: nutriments?.sugars100g,
            sodiumMilligramsPer100g: nutriments?.sodium100g.map { $0 * 1_000 },
            imageURL: imageFrontSmallURL
        )
    }
}

private struct Nutriments: Decodable {
    var energyKcal100g: Double?
    var proteins100g: Double?
    var carbohydrates100g: Double?
    var fat100g: Double?
    var fiber100g: Double?
    var sugars100g: Double?
    var sodium100g: Double?

    enum CodingKeys: String, CodingKey {
        case energyKcal100g = "energy-kcal_100g"
        case proteins100g = "proteins_100g"
        case carbohydrates100g = "carbohydrates_100g"
        case fat100g = "fat_100g"
        case fiber100g = "fiber_100g"
        case sugars100g = "sugars_100g"
        case sodium100g = "sodium_100g"
    }
}
