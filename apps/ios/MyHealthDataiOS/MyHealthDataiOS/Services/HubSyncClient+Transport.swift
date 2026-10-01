import Foundation

extension HubSyncClient {
    static func sha256Hex(_ data: Data) -> String {
        MHDHashing.sha256Hex(data)
    }

    /// Derives a deterministic UUID-shaped key for idempotent Hub mutations.
    /// The input remains private to the device and never contains health data
    /// outside the signed request itself.
    func stableMutationID(_ id: String) -> String {
        let data = Data(id.utf8)
        let hash = Self.sha256Hex(data)
        return "\(hash.prefix(8))-\(hash.dropFirst(8).prefix(4))-4\(hash.dropFirst(13).prefix(3))-8\(hash.dropFirst(17).prefix(3))-\(hash.dropFirst(20).prefix(12))"
    }

    func requestData(
        path: String,
        endpoint: URL,
        method: String = "GET",
        bodyData: Data = Data(),
        headers: [String: String] = [:]
    ) async throws -> Data {
        guard let url = URL(string: path, relativeTo: endpoint) else {
            throw Error.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }
        if !bodyData.isEmpty {
            request.httpBody = bodyData
        }

        let (data, response) = try await Self.session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let code = (try? JSONDecoder().decode(APIError.self, from: data))?.error ?? "request_failed"
            throw Error.server(code)
        }
        return data
    }

    /// A first sync writes a large store: allow slow batches and big downloads
    /// without failing at the 60 s default.
    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 120
        configuration.timeoutIntervalForResource = 1800
        configuration.waitsForConnectivity = true
        return URLSession(configuration: configuration)
    }()

    func perform<Response: Decodable, Body: Encodable>(
        path: String,
        endpoint: URL,
        method: String = "GET",
        body: Body? = Optional<Empty>.none,
        headers: [String: String] = [:]
    ) async throws -> Response {
        let bodyData = try body.map { try JSONEncoder().encode($0) } ?? Data()
        let data = try await requestData(
            path: path,
            endpoint: endpoint,
            method: method,
            bodyData: bodyData,
            headers: headers
        )
        guard let decoded = try? JSONDecoder().decode(Response.self, from: data) else {
            throw Error.invalidResponse
        }
        return decoded
    }

    func perform<Response: Decodable>(
        path: String,
        endpoint: URL,
        method: String = "GET",
        bodyData: Data,
        headers: [String: String]
    ) async throws -> Response {
        let data = try await requestData(
            path: path,
            endpoint: endpoint,
            method: method,
            bodyData: bodyData,
            headers: headers
        )
        guard let decoded = try? JSONDecoder().decode(Response.self, from: data) else {
            throw Error.invalidResponse
        }
        return decoded
    }
}
