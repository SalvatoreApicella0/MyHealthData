# Third-party notices

## Microsoft Rocketbox Avatar Library

- Source: https://github.com/microsoft/Microsoft-Rocketbox
- License: MIT
- App asset path: `apps/ios/MyHealthDataiOS/MyHealthDataiOS/Resources/Models/RocketboxHuman/`
- Notes: `Female_Adult_01` was converted from FBX to OBJ with Assimp for SceneKit runtime loading. Texture maps were converted from TGA to JPEG for app bundle size.

The original MIT license text is included alongside the app asset as `LICENSE-Microsoft-Rocketbox.md`.

## BodyParts3D 4.0 (Human Atlas geometry)

- Source: https://github.com/ashemag/human-atlas (MIT application code)
- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- License: CC BY 4.0 (© The Database Center for Life Science)
- App asset path: `public/models/`
- Notes: `atlas.json` manifest and 15 gzip geometry chunks, adapted to meters/Y-up
  with meshoptimizer simplification and quantized normals. Full attribution in
  `public/models/ATTRIBUTION.md`; the viewer shows a "Fonti e crediti" panel.

## Exercise metadata

- Source: https://github.com/hasaneyldrm/exercises-dataset
- License: MIT for non-media data; bundled license in `apps/ios/MyHealthDataiOS/MyHealthDataiOS/Resources/GymDataset/LICENSE`.
- Only exercise metadata is distributed here. Gym visual images and GIFs are excluded; their separate permission is not granted by this project's license.

## Excluded legacy model

`FinalBaseMesh.obj` is excluded because its redistribution provenance is not documented. The native viewer uses the included MIT-licensed Rocketbox model, with an existing procedural fallback.
