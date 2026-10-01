# iOS App

MyHealthData now includes a native SwiftUI iOS companion app in `apps/ios/MyHealthDataiOS`.

The current Xcode project contains three targets: the iOS app, its Share
Extension and the unit-test bundle. Watch, WidgetKit and WatchConnectivity
targets were intentionally retired from the product boundary; references to
those targets in delivery logs describe older builds and are not active build
requirements.

## Current Scope

- Local-first iOS app.
- No required account.
- Local encrypted vault using AES-GCM.
- Vault key generated on device and stored in Keychain.
- HealthKit read import for activity, vitals, sleep, and body measurements.
- Manual event and measurement logging.
- Body-region event linking through semantic MHD body region IDs.
- Front/back digital body twin for selecting body regions and reviewing linked events.
- MHD JSON export/import compatible with the web app.
- English and Italian localization.
- Optional future sync design documented separately.

## Why Native iOS First

Native SwiftUI is the best initial fit because Apple Health access, Keychain, file protection, TestFlight, and app signing are all Apple-platform concerns. Android can later implement the same MHD schema with Health Connect without forcing the iOS implementation through a cross-platform abstraction too early.

## Local Storage

The app stores one encrypted vault file in Application Support. The file contains the MHD snapshot:

- profile
- events
- measurements
- documents metadata

The vault is encrypted with CryptoKit AES-GCM. The symmetric key is generated locally and stored in Keychain with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.

This protects the app-managed file at rest, but it does not protect against a compromised device, malicious extensions/profiles, screenshots, or data while the app is unlocked and running.

## HealthKit Import

The current importer reads recent samples after user authorization:

- body mass
- height
- body mass index
- body fat percentage
- lean body mass
- waist circumference
- heart rate
- resting heart rate
- heart rate variability
- oxygen saturation
- respiratory rate
- VO2 max
- blood glucose
- body temperature
- systolic and diastolic blood pressure
- step count
- active energy burned
- basal energy burned
- walking/running distance
- flights climbed
- exercise minutes
- sleep analysis
- mindful sessions

Imported records are stored as MHD `Measurement` records with:

- `source: "apple_health"`
- `sourceRecordId`: HealthKit sample UUID
- a note identifying Apple Health provenance

MyHealthData does not write to Apple Health in this version.

iOS may not re-display every previously answered HealthKit category when the app asks again. The app includes a settings entry to request authorization again, and users can always adjust access from the Health app or iOS Settings.

## Build e test

Generate the Xcode project:

```sh
npm run ios:generate
```

Build the app and run the unit tests on Mac Catalyst without requiring a signing identity:

```sh
npm run ios:test:catalyst
```

For a build-only check:

```sh
npm run ios:build:catalyst
```

To build only the test bundle:

```sh
npm run ios:build:tests:catalyst
```

The project also supports iOS Simulator and physical-device destinations when the corresponding Xcode runtime/device is installed. Pass the destination directly to `xcodebuild` for those environments; the repository gate remains Catalyst so it is reproducible on a clean macOS host.

```sh
xcodebuild -project apps/ios/MyHealthDataiOS/MyHealthDataiOS.xcodeproj \
  -scheme MyHealthDataiOS \
  -destination 'platform=iOS Simulator,name=<installed simulator>' test
```

To launch in Simulator, install an iOS runtime compatible with the current Xcode in Xcode Settings > Components, then use the `MyHealthDataiOS` scheme.
