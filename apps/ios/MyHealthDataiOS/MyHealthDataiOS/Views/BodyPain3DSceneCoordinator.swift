import SceneKit
import SwiftUI
import UIKit

extension DigitalTwinSceneView {
    @MainActor final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        lazy var painMaterialsBySystem: [String: SCNMaterial] = [
            "integumentary": Self.makePainMaterial(
                color: UIColor(red: 0xBA / 255, green: 0x9B / 255, blue: 0x7D / 255, alpha: 1),
                transparent: true
            ),
            "skeletal": Self.makePainMaterial(color: UIColor(red: 0xE2 / 255, green: 0xD9 / 255, blue: 0xBA / 255, alpha: 1)),
            "muscular": Self.makePainMaterial(color: UIColor(red: 0xA8 / 255, green: 0x5B / 255, blue: 0x50 / 255, alpha: 1)),
            "nervous": Self.makePainMaterial(color: UIColor(red: 0xD8 / 255, green: 0xB5 / 255, blue: 0x65 / 255, alpha: 1))
        ]

        weak var sceneView: SCNView?

        private var onPointPicked: (BodyPoint) -> Void
        let bodyRoot = SCNNode()
        let hotspotRoot = SCNNode()
        let markerRoot = SCNNode()
        private(set) var cameraNode: SCNNode?
        private(set) var cameraTargetNode: SCNNode?
        private var cameraControllerTarget = SCNVector3(0, 0.02, 0)
        var hotspotNodes: [BodyRegionId: SCNNode] = [:]
        private var isPickingPoint = false
        var pendingPoint: BodyPoint?
        var events: [HealthEvent] = []
        var selectedEventID: String?
        private var lastPersistedCameraState: BodyPainCameraState?
        private var cameraPersistenceTask: Task<Void, Never>?
        var atlasLoadTask: Task<Void, Never>?
        var atlasDecodeTask: Task<[BodyParts3DMeshData], Error>?
        var isBodyParts3DReady = false
        var painPartsByID: [String: BodyParts3DPart] = [:]
        var atlasRegionAnchors: [BodyRegionId: SCNVector3] = [:]

        var cameraTarget: SCNVector3 {
            cameraControllerTarget
        }

        init(onPointPicked: @escaping (BodyPoint) -> Void) {
            self.onPointPicked = onPointPicked
            super.init()
        }

        func makeScene() -> SCNScene {
            let scene = SCNScene()
            scene.background.contents = UIColor.clear

            let cameraTarget = SCNNode()
            cameraTarget.position = SCNVector3(0, 0.15, 0)
            scene.rootNode.addChildNode(cameraTarget)
            self.cameraTargetNode = cameraTarget

            let cameraNode = SCNNode()
            cameraNode.camera = SCNCamera()
            cameraNode.camera?.fieldOfView = 30
            cameraNode.position = SCNVector3(0, 0.18, 8.1)
            cameraNode.constraints = [SCNLookAtConstraint(target: cameraTarget)]
            scene.rootNode.addChildNode(cameraNode)
            self.cameraNode = cameraNode

            addLights(to: scene)

            bodyRoot.name = "realistic-body-root"
            bodyRoot.scale = SCNVector3(0.88, 0.88, 0.88)
            bodyRoot.position = SCNVector3(0, -0.04, 0)
            scene.rootNode.addChildNode(bodyRoot)

            if let modelNode = DigitalTwinModelFactory.makeRocketboxModelNode() ?? DigitalTwinModelFactory.makeBodyModelNode() {
                bodyRoot.addChildNode(modelNode)
            } else {
                bodyRoot.addChildNode(DigitalTwinModelFactory.makeFallbackBodyNode())
            }

            hotspotRoot.name = "anatomical-hotspots"
            markerRoot.name = "anatomical-markers"
            bodyRoot.addChildNode(hotspotRoot)
            bodyRoot.addChildNode(markerRoot)
            buildHotspots()

            return scene
        }

        func update(isPickingPoint: Bool, pendingPoint: BodyPoint?, events: [HealthEvent], selectedEventID: String?, onPointPicked: @escaping (BodyPoint) -> Void) {
            // SwiftUI can call updateUIView immediately after a point is
            // selected. Keep the user's orbit exactly as it was while the
            // markers/highlights are rebuilt; selection must never snap the
            // anatomy back to its default camera pose.
            let cameraPosition = sceneView?.pointOfView?.position
            let cameraOrientation = sceneView?.pointOfView?.orientation
            let cameraTarget = sceneView?.defaultCameraController.target
            let cameraFieldOfView = sceneView?.pointOfView?.camera?.fieldOfView
            self.onPointPicked = onPointPicked
            let markersChanged = self.isPickingPoint != isPickingPoint
                || self.pendingPoint != pendingPoint
                || self.events != events
                || self.selectedEventID != selectedEventID
            self.isPickingPoint = isPickingPoint
            self.pendingPoint = pendingPoint
            self.events = events
            self.selectedEventID = selectedEventID
            if markersChanged {
                updateHotspots()
                rebuildMarkers()
            }
            if let cameraPosition, let cameraOrientation, let sceneView {
                sceneView.pointOfView?.position = cameraPosition
                sceneView.pointOfView?.orientation = cameraOrientation
                if let cameraFieldOfView {
                    sceneView.pointOfView?.camera?.fieldOfView = cameraFieldOfView
                }
                if let cameraTarget {
                    sceneView.defaultCameraController.target = cameraTarget
                }
            }
        }

        func persistCameraState() {
            // Only the canonical atlas camera has stable coordinates. This is
            // called after gestures settle or when the view is dismantled,
            // never from SceneKit's per-frame render callback.
            guard isBodyParts3DReady else { return }
            guard let sceneView,
                  let pointOfView = sceneView.pointOfView,
                  let camera = pointOfView.camera else { return }
            let state = BodyPainCameraState(
                position: .init(pointOfView.position),
                orientation: .init(pointOfView.orientation),
                target: .init(sceneView.defaultCameraController.target),
                fieldOfView: Double(camera.fieldOfView)
            )
            guard state != lastPersistedCameraState else { return }
            BodyPainCameraStateStore.save(state)
            lastPersistedCameraState = state
        }

        func cancelCameraPersistence() {
            cameraPersistenceTask?.cancel()
            cameraPersistenceTask = nil
        }

        func cancelAtlasLoad() {
            atlasLoadTask?.cancel()
            atlasLoadTask = nil
            atlasDecodeTask?.cancel()
            atlasDecodeTask = nil
        }

        @objc func handleCameraGesture(_ recognizer: UIGestureRecognizer) {
            switch recognizer.state {
            case .began, .changed:
                cancelCameraPersistence()
            case .ended, .cancelled, .failed:
                scheduleCameraPersistence()
            default:
                break
            }
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            // These recognizers observe SceneKit's native camera gestures; they
            // must not replace or prevent the camera controller from handling them.
            true
        }

        private func scheduleCameraPersistence() {
            cancelCameraPersistence()
            cameraPersistenceTask = Task { @MainActor [weak self] in
                do {
                    try await Task.sleep(for: .milliseconds(800))
                } catch {
                    return
                }
                guard !Task.isCancelled else { return }
                self?.persistCameraState()
            }
        }

        func applyWebCanonicalCamera() {
            guard let sceneView, let cameraNode, let cameraTargetNode else { return }
            let center = SCNVector3(0, 0.87, 0)
            cameraTargetNode.position = center
            cameraControllerTarget = center
            sceneView.defaultCameraController.target = center
            let fov = Float(34 * Double.pi / 180)
            let aspect = max(0.35, Float(sceneView.bounds.width / max(sceneView.bounds.height, 1)))
            let halfTangent = tan(fov / 2)
            let distance = max(0.865 / halfTangent, 0.335 / (halfTangent * aspect)) * 1.16
            let direction = SCNVector3(0.35, 0.06, 1).normalized
            cameraNode.position = center + direction.scaled(by: distance)
            cameraNode.camera?.fieldOfView = 34
            lastPersistedCameraState = nil
        }

        func applyCameraState(_ state: BodyPainCameraState) {
            guard let sceneView, let cameraNode, let cameraTargetNode else { return }
            cameraTargetNode.position = state.target.sceneKitValue
            cameraControllerTarget = state.target.sceneKitValue
            cameraNode.position = state.position.sceneKitValue
            cameraNode.orientation = state.orientation.sceneKitValue
            cameraNode.camera?.fieldOfView = CGFloat(min(max(state.fieldOfView, 5), 120))
            sceneView.defaultCameraController.target = state.target.sceneKitValue
            lastPersistedCameraState = state
        }

        @MainActor @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            guard isPickingPoint, let sceneView else { return }
            let location = recognizer.location(in: sceneView)
            let hits = sceneView.hitTest(location, options: [
                .boundingBoxOnly: false,
                .firstFoundOnly: false
            ])

            for hit in hits {
                guard regionId(for: hit.node) == nil else {
                    continue
                }

                let localPoint = bodyRoot.convertPosition(hit.worldCoordinates, from: nil)
                guard localPoint.y > -1.7, localPoint.y < 1.9 else { continue }
                guard isBodyParts3DReady else {
                    guard let region = BodyPain3DRegionMapping.nearestLegacyRegion(to: localPoint) else { continue }
                    onPointPicked(BodyPoint(
                        x: Double(localPoint.x),
                        y: Double(localPoint.y),
                        z: Double(localPoint.z),
                        approximateRegionId: region,
                        modelVersion: BodyPain3DRegionMapping.legacyBodyModelVersion
                    ))
                    return
                }

                let partID = hit.node.name
                guard isBodyParts3DReady,
                      let partID,
                      let part = painPartsByID[partID] else {
                    continue
                }

                // Web stores the intersection in the untransformed atlas
                // coordinate space. The canonical root is identity-scaled.
                let bodyPoint = BodyPoint(
                    x: Double(localPoint.x),
                    y: Double(localPoint.y),
                    z: Double(localPoint.z),
                    approximateRegionId: BodyPain3DRegionMapping.regionForTap(part: part, point: localPoint),
                    modelVersion: BodyPain3DRegionMapping.webBodyModelVersion
                )
                onPointPicked(bodyPoint)
                return
            }
        }

        private func regionId(for node: SCNNode) -> BodyRegionId? {
            var current: SCNNode? = node
            while let node = current {
                if let name = node.name, let region = BodyRegionId(rawValue: name) {
                    return region
                }
                current = node.parent
            }
            return nil
        }
    }
}
