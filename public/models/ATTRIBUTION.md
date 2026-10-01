# Anatomy data attribution

BodyParts3D, © The Database Center for Life Science licensed under CC
Attribution 4.0 International.

- License: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- License terms: https://creativecommons.org/licenses/by/4.0/
- Source geometry: `isa_BP3D_4.0_obj_99.zip`, BodyParts3D 4.0.
- Publication: Mitsuhashi et al. (2009), BodyParts3D: 3D structure database
  for anatomical concepts. https://doi.org/10.1093/nar/gkn613

Adaptations: axes and units converted from millimeters/Z-up to meters/Y-up;
geometry simplified with meshoptimizer (0.2% relative error limit per
structure); normals quantized to signed 16-bit; packed into gzip binary
chunks; curated display system groupings and colors. The source contains
2,234 individual OBJ meshes; all remain represented.

The viewer application code is adapted from Human Atlas
(https://github.com/ashemag/human-atlas, MIT). The anatomy data keeps its own
CC BY 4.0 license. This is an educational anatomical reference, not a
diagnostic tool.
