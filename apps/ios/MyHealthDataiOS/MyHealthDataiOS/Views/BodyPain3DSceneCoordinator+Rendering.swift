import SceneKit
import UIKit

extension DigitalTwinSceneView.Coordinator {
    func loadBodyParts3DAtlas() {
        cancelAtlasLoad()
        let decodeTask = Task.detached(priority: .userInitiated) {
            try BodyParts3DAtlas.loadPainLayer()
        }
        atlasDecodeTask = decodeTask
        atlasLoadTask = Task { [weak self] in
            let result = await decodeTask.result
            guard !Task.isCancelled, let self else { return }
            self.atlasDecodeTask = nil
            if case .success(var meshes) = result {
                await self.installBodyParts3D(meshes)
                meshes.removeAll(keepingCapacity: false)
            }
        }
    }

    private func installBodyParts3D(_ meshes: [BodyParts3DMeshData]) async {
        guard !isBodyParts3DReady else { return }
        let painSystems: Set<String> = ["integumentary", "skeletal", "muscular", "nervous"]
        let painMeshes = meshes.filter { painSystems.contains($0.part.system) }
        guard !painMeshes.isEmpty else { return }

        // Create geometry in small main-actor slices so the first load
        // does not monopolize the scrolling UI for all 842 atlas meshes.
        // The staging root stays hidden until every mesh is ready.
        let stagingRoot = SCNNode()
        stagingRoot.name = "bodyparts3d-staging"
        stagingRoot.isHidden = true
        bodyRoot.addChildNode(stagingRoot)
        var partNodes: [(BodyParts3DPart, SCNNode)] = []
        partNodes.reserveCapacity(painMeshes.count)
        for (index, mesh) in painMeshes.enumerated() {
            if Task.isCancelled {
                stagingRoot.removeFromParentNode()
                return
            }
            guard let geometry = DigitalTwinGeometryFactory.makeGeometry(
                from: mesh,
                material: painMaterialsBySystem[mesh.part.system]
            ) else {
                stagingRoot.removeFromParentNode()
                return
            }
            let partNode = SCNNode(geometry: geometry)
            partNode.name = mesh.part.id
            partNodes.append((mesh.part, partNode))
            stagingRoot.addChildNode(partNode)
            if index.isMultiple(of: 32) { await Task.yield() }
        }
        guard partNodes.count == painMeshes.count, !Task.isCancelled else {
            stagingRoot.removeFromParentNode()
            return
        }

        // Atlas coordinates are already meters/Y-up, exactly as in Web.
        // Keep the root unscaled so stored pins and hit positions share
        // the canonical bodyparts3d-4.0 coordinate space.
        for child in bodyRoot.childNodes
        where child !== hotspotRoot && child !== markerRoot && child !== stagingRoot {
            child.removeFromParentNode()
        }
        bodyRoot.position = SCNVector3Zero
        bodyRoot.scale = SCNVector3(1, 1, 1)
        stagingRoot.isHidden = false

        painPartsByID = Dictionary(uniqueKeysWithValues: partNodes.map { ($0.0.id, $0.0) })
        var centersByRegion: [BodyRegionId: [SCNVector3]] = [:]
        for (part, _) in partNodes {
            guard part.system != "integumentary",
                  let region = BodyPain3DRegionMapping.regionForPart(part) else { continue }
            let center = SCNVector3(
                (part.bounds[0][0] + part.bounds[1][0]) / 2,
                (part.bounds[0][1] + part.bounds[1][1]) / 2,
                (part.bounds[0][2] + part.bounds[1][2]) / 2
            )
            centersByRegion[region, default: []].append(center)
        }
        atlasRegionAnchors = centersByRegion.mapValues { centers in
            let total = centers.reduce(SCNVector3Zero, +)
            return total.scaled(by: 1 / Float(centers.count))
        }
        isBodyParts3DReady = true
        applyWebCanonicalCamera()
        if let savedCamera = BodyPainCameraStateStore.load() {
            applyCameraState(savedCamera)
        }
        updateHotspots()
        rebuildMarkers()
    }

    func addLights(to scene: SCNScene) {
        let ambientLight = SCNLight()
        ambientLight.type = .ambient
        ambientLight.intensity = 360
        ambientLight.color = UIColor(red: 0.78, green: 0.86, blue: 0.9, alpha: 1)
        let ambientNode = SCNNode()
        ambientNode.light = ambientLight
        scene.rootNode.addChildNode(ambientNode)

        let keyLight = SCNLight()
        keyLight.type = .directional
        keyLight.intensity = 1320
        keyLight.castsShadow = true
        keyLight.shadowRadius = 10
        let keyNode = SCNNode()
        keyNode.light = keyLight
        keyNode.position = SCNVector3(3.2, 4.8, 4.5)
        keyNode.eulerAngles = SCNVector3(-0.78, 0.52, 0)
        scene.rootNode.addChildNode(keyNode)

        let rimLight = SCNLight()
        rimLight.type = .omni
        rimLight.intensity = 520
        rimLight.color = UIColor(red: 0.24, green: 0.58, blue: 0.74, alpha: 1)
        let rimNode = SCNNode()
        rimNode.light = rimLight
        rimNode.position = SCNVector3(-1.7, 1.7, 2.0)
        scene.rootNode.addChildNode(rimNode)
    }

    func buildHotspots() {
        hotspotRoot.childNodes.forEach { $0.removeFromParentNode() }
        hotspotNodes.removeAll()

        for hotspot in BodyPain3DRegionMapping.anatomicalHotspots {
            let node = DigitalTwinMarkerFactory.makeHotspotNode(for: hotspot)
            hotspotRoot.addChildNode(node)
            hotspotNodes[hotspot.region] = node
        }
    }

    func updateHotspots() {
        for hotspot in BodyPain3DRegionMapping.anatomicalHotspots {
            guard let node = hotspotNodes[hotspot.region] else { continue }
            node.scale = SCNVector3(1, 1, 1)

            for child in node.childNodes {
                child.opacity = 0.001
            }
        }
    }

    func rebuildMarkers() {
        markerRoot.childNodes.forEach { $0.removeFromParentNode() }

        for event in events {
            guard isBodyParts3DReady,
                  let point = event.bodyPoint,
                  point.modelVersion == BodyPain3DRegionMapping.webBodyModelVersion else { continue }
            let isSelected = event.id == selectedEventID
            let color = isSelected ? UIColor.systemCyan : DigitalTwinMarkerFactory.eventColor(type: event.type, intensity: event.intensity ?? 0)
            markerRoot.addChildNode(DigitalTwinMarkerFactory.makePointMarker(point: point, color: color, radius: isSelected ? 0.052 : 0.024))
        }

        if let pendingPoint {
            let pendingColor = UIColor(red: 0.15, green: 0.86, blue: 0.92, alpha: 1)
            if isBodyParts3DReady {
                if pendingPoint.modelVersion == BodyPain3DRegionMapping.webBodyModelVersion {
                    markerRoot.addChildNode(DigitalTwinMarkerFactory.makePointMarker(point: pendingPoint, color: pendingColor, radius: 0.032))
                } else if let region = pendingPoint.approximateRegionId,
                          let anchor = atlasRegionAnchors[region] {
                    let regionalPoint = BodyPoint(
                        x: Double(anchor.x), y: Double(anchor.y), z: Double(anchor.z),
                        approximateRegionId: region,
                        modelVersion: BodyPain3DRegionMapping.webBodyModelVersion
                    )
                    markerRoot.addChildNode(DigitalTwinMarkerFactory.makePointMarker(point: regionalPoint, color: pendingColor, radius: 0.044))
                }
            } else if pendingPoint.modelVersion == BodyPain3DRegionMapping.legacyBodyModelVersion {
                markerRoot.addChildNode(DigitalTwinMarkerFactory.makePointMarker(point: pendingPoint, color: pendingColor, radius: 0.032))
            }
        }

        for hotspot in BodyPain3DRegionMapping.anatomicalHotspots {
            let stats = DigitalTwinMarkerFactory.eventStats(for: hotspot.region, events: events)
            guard stats.count > 0 else { continue }
            guard !events.contains(where: {
                $0.bodyPoint?.modelVersion == BodyPain3DRegionMapping.webBodyModelVersion
                    && isBodyParts3DReady
                    && DigitalTwinMarkerFactory.eventRegion($0) == hotspot.region
            }) else { continue }

            let marker = DigitalTwinMarkerFactory.makeMarker(hotspot: hotspot, stats: stats, anchors: atlasRegionAnchors)
            markerRoot.addChildNode(marker)
        }
    }

    static func makePainMaterial(color: UIColor, transparent: Bool = false) -> SCNMaterial {
        let material = SCNMaterial()
        material.diffuse.contents = color
        material.roughness.contents = 0.53
        material.metalness.contents = 0.08
        material.lightingModel = .physicallyBased
        material.isDoubleSided = true
        material.transparency = transparent ? 0.12 : 1
        material.writesToDepthBuffer = !transparent
        return material
    }
}
