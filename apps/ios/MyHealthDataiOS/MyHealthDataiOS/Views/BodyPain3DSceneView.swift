import SceneKit
import SwiftUI
import UIKit

struct DigitalTwinSceneView: UIViewRepresentable {
    var isPickingPoint: Bool
    var pendingPoint: BodyPoint?
    var events: [HealthEvent]
    var selectedEventID: String?
    var onPointPicked: (BodyPoint) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onPointPicked: onPointPicked)
    }

    func makeUIView(context: Context) -> SCNView {
        let sceneView = SCNView(frame: .zero)
        sceneView.backgroundColor = .clear
        sceneView.scene = context.coordinator.makeScene()
        sceneView.pointOfView = context.coordinator.cameraNode
        sceneView.antialiasingMode = .multisampling4X
        sceneView.allowsCameraControl = true
        sceneView.defaultCameraController.interactionMode = .orbitTurntable
        sceneView.defaultCameraController.target = context.coordinator.cameraTarget
        sceneView.defaultCameraController.maximumVerticalAngle = 80
        sceneView.defaultCameraController.minimumVerticalAngle = -55
        sceneView.isJitteringEnabled = false

        let tapRecognizer = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        sceneView.addGestureRecognizer(tapRecognizer)
        let cameraGestureRecognizers: [UIGestureRecognizer] = [
            UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleCameraGesture(_:))),
            UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleCameraGesture(_:))),
            UIRotationGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleCameraGesture(_:)))
        ]
        for recognizer in cameraGestureRecognizers {
            recognizer.cancelsTouchesInView = false
            recognizer.delegate = context.coordinator
            sceneView.addGestureRecognizer(recognizer)
        }
        context.coordinator.sceneView = sceneView
        context.coordinator.loadBodyParts3DAtlas()
        context.coordinator.update(
            isPickingPoint: isPickingPoint,
            pendingPoint: pendingPoint,
            events: events,
            selectedEventID: selectedEventID,
            onPointPicked: onPointPicked
        )
        return sceneView
    }

    static func dismantleUIView(_ sceneView: SCNView, coordinator: Coordinator) {
        coordinator.cancelAtlasLoad()
        coordinator.cancelCameraPersistence()
        coordinator.persistCameraState()
    }

    func updateUIView(_ sceneView: SCNView, context: Context) {
        context.coordinator.sceneView = sceneView
        context.coordinator.update(
            isPickingPoint: isPickingPoint,
            pendingPoint: pendingPoint,
            events: events,
            selectedEventID: selectedEventID,
            onPointPicked: onPointPicked
        )
    }

}
