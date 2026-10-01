import SwiftUI

private let rowDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .short
    return formatter
}()

struct EventRow: View {
    var event: HealthEvent

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if event.bodyPoint != nil || event.bodyRegionId != nil {
                BodyPointSnapshot(event: event)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(event.type.label)
                        .font(.subheadline.bold())
                    Spacer()
                    Text(rowDateFormatter.string(from: event.occurredAt))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(event.description)
                    .font(.subheadline)
                HStack(spacing: 8) {
                    if let point = event.bodyPoint {
                        Label(point.approximateRegionLabel, systemImage: "mappin.and.ellipse")
                    } else if let region = event.bodyRegionId {
                        Label(region.label, systemImage: "figure.stand")
                    }
                    if let intensity = event.intensity {
                        Label("\(intensity)/10", systemImage: "gauge.with.dots.needle.67percent")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct MeasurementRow: View {
    var measurement: Measurement

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(measurement.type.label)
                    .font(.subheadline.bold())
                Spacer()
                Text(rowDateFormatter.string(from: measurement.measuredAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text("\(measurement.value.formatted(.number.precision(.fractionLength(0...2)))) \(measurement.unit)")
                .font(.subheadline)
            if measurement.source == .appleHealth {
                Label("Apple Health", systemImage: "heart.circle")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct BodyPointSnapshot: View {
    var event: HealthEvent

    private var point: CGPoint {
        if let bodyPoint = event.bodyPoint {
            return CGPoint(
                x: normalized(bodyPoint.x, min: -1.05, max: 1.05),
                y: 1 - normalized(bodyPoint.y, min: -1.6, max: 1.75)
            )
        }

        if let region = event.bodyRegionId {
            return region.snapshotPoint
        }

        return CGPoint(x: 0.5, y: 0.5)
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.mhdPrimary.opacity(0.08))
            Image(systemName: "figure.stand")
                .font(.system(size: 32, weight: .regular))
                .foregroundStyle(Color.mhdPrimary.opacity(0.42))
            GeometryReader { proxy in
                Circle()
                    .fill(markerColor)
                    .frame(width: 6, height: 6)
                    .overlay(Circle().stroke(.white, lineWidth: 1.5))
                    .shadow(color: markerColor.opacity(0.35), radius: 3)
                    .position(
                        x: point.x * proxy.size.width,
                        y: point.y * proxy.size.height
                    )
            }
            .padding(8)
        }
        .frame(width: 48, height: 58)
        .accessibilityHidden(true)
    }

    private var markerColor: Color {
        if (event.intensity ?? 0) >= 8 {
            return .red
        }

        switch event.type {
        case .burning:
            return .orange
        case .swelling:
            return .purple
        case .stiffness:
            return .teal
        case .tingling:
            return .blue
        default:
            return .red
        }
    }

    private func normalized(_ value: Double, min: Double, max: Double) -> Double {
        guard max > min else { return 0.5 }
        return Swift.min(Swift.max((value - min) / (max - min), 0), 1)
    }
}

private extension BodyRegionId {
    var snapshotPoint: CGPoint {
        switch self {
        case .head: CGPoint(x: 0.5, y: 0.12)
        case .neck: CGPoint(x: 0.5, y: 0.24)
        case .chest: CGPoint(x: 0.5, y: 0.34)
        case .abdomen: CGPoint(x: 0.5, y: 0.48)
        case .upperBack: CGPoint(x: 0.5, y: 0.36)
        case .lowerBack: CGPoint(x: 0.5, y: 0.52)
        case .rightShoulder: CGPoint(x: 0.31, y: 0.3)
        case .leftShoulder: CGPoint(x: 0.69, y: 0.3)
        case .rightArm: CGPoint(x: 0.22, y: 0.46)
        case .leftArm: CGPoint(x: 0.78, y: 0.46)
        case .rightElbow: CGPoint(x: 0.19, y: 0.54)
        case .leftElbow: CGPoint(x: 0.81, y: 0.54)
        case .rightHand: CGPoint(x: 0.2, y: 0.72)
        case .leftHand: CGPoint(x: 0.8, y: 0.72)
        case .rightHip: CGPoint(x: 0.4, y: 0.62)
        case .leftHip: CGPoint(x: 0.6, y: 0.62)
        case .rightLeg: CGPoint(x: 0.42, y: 0.76)
        case .leftLeg: CGPoint(x: 0.58, y: 0.76)
        case .rightKnee: CGPoint(x: 0.43, y: 0.84)
        case .leftKnee: CGPoint(x: 0.57, y: 0.84)
        case .rightFoot: CGPoint(x: 0.42, y: 0.96)
        case .leftFoot: CGPoint(x: 0.58, y: 0.96)
        }
    }
}
