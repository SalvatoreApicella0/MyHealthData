import Foundation
import Network
import Observation

/// Bonjour discovery for `_myhealthdata._tcp`.
///
/// The browse result only carries the service name; resolving it through
/// `NetService` gives the reachable `host:port`, which is what actually matters
/// when a device has to decide which Hub to join.
@MainActor
@Observable
final class HubDiscoveryService: NSObject, NetServiceDelegate {
    struct Hub: Identifiable, Equatable {
        let id: String
        let name: String
        let address: String

        var title: String { address.isEmpty ? name : address }
        var subtitle: String? { address.isEmpty ? nil : name }
    }

    private var browser: NWBrowser?
    private var resolvers: [String: NetService] = [:]
    private var names: [String: String] = [:]
    private var addresses: [String: String] = [:]
    private(set) var hubs: [Hub] = []
    private(set) var isSearching = false

    func start() {
        guard browser == nil else { return }
        let browser = NWBrowser(for: .bonjour(type: "_myhealthdata._tcp", domain: nil), using: .tcp)
        browser.browseResultsChangedHandler = { [weak self] results, _ in
            let services = results.compactMap { result -> (name: String, domain: String)? in
                guard case let .service(name: name, type: _, domain: domain, interface: _) = result.endpoint else { return nil }
                return (name, domain)
            }
            Task { @MainActor [weak self] in self?.update(services: services) }
        }
        browser.stateUpdateHandler = { [weak self] state in
            Task { @MainActor [weak self] in self?.isSearching = state == .ready }
        }
        self.browser = browser
        browser.start(queue: .main)
    }

    func stop() {
        browser?.cancel()
        browser = nil
        resolvers.values.forEach { $0.stop() }
        resolvers.removeAll()
        addresses.removeAll()
        names.removeAll()
        hubs = []
        isSearching = false
    }

    private func update(services: [(name: String, domain: String)]) {
        let visible = Set(services.map { "\($0.name).\($0.domain)" })
        for service in services {
            let key = "\(service.name).\(service.domain)"
            names[key] = service.name
            guard resolvers[key] == nil else { continue }
            let resolver = NetService(domain: service.domain, type: "_myhealthdata._tcp.", name: service.name)
            resolver.delegate = self
            resolvers[key] = resolver
            resolver.resolve(withTimeout: 3)
        }
        for key in resolvers.keys where !visible.contains(key) {
            resolvers[key]?.stop()
            resolvers[key] = nil
            names[key] = nil
            addresses[key] = nil
        }
        rebuild()
    }

    private func rebuild() {
        hubs = names.keys.compactMap { key in
            guard let name = names[key] else { return nil }
            return Hub(id: key, name: name, address: addresses[key] ?? "")
        }
        .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    nonisolated func netServiceDidResolveAddress(_ sender: NetService) {
        let address = Self.numericAddress(sender) ?? sender.hostName ?? ""
        let key = "\(sender.name).\(sender.domain)"
        let display = address.isEmpty ? "" : "\(address):\(sender.port)"
        Task { @MainActor [weak self] in
            self?.addresses[key] = display
            self?.rebuild()
        }
    }

    nonisolated func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
        // The service may still resolve on a later browse pass; nothing to do.
    }

    nonisolated private static func numericAddress(_ service: NetService) -> String? {
        guard let data = service.addresses?.first else { return nil }
        return data.withUnsafeBytes { raw -> String? in
            guard let base = raw.baseAddress else { return nil }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            let result = getnameinfo(
                base.assumingMemoryBound(to: sockaddr.self),
                socklen_t(raw.count),
                &host,
                socklen_t(host.count),
                nil,
                0,
                NI_NUMERICHOST
            )
            guard result == 0 else { return nil }
            let bytes = host.prefix(while: { $0 != 0 }).map { UInt8(bitPattern: $0) }
            return String(decoding: bytes, as: UTF8.self)
        }
    }
}
