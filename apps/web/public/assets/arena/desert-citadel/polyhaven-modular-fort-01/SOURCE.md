# Desert Citadel asset provenance

## Modular Fort 01

- Creator: Rico Cilliers
- Source: https://polyhaven.com/a/modular_fort_01
- License: CC0
- Commercial use: allowed
- Modification: allowed
- Attribution: not required by the asset license; Poly Haven is credited in this file and in the map report
- Download format: glTF 2.0 + external binary/textures
- Source asset: 28,218 triangles; source page lists 71.4 m width and 13.7 m height
- QuizStrike format: glTF 2.0, 1K PBR texture set
- Local file size: approximately 9.6 MB including the binary and textures

### QuizStrike changes

- Curated the modular fort collection as a two-instance hero accent for the
  Crown Rampart rather than using it as gameplay collision.
- Reused the authored GLTF scene through the shared cached loader and cloned it
  for the mirrored west/east rampart positions.
- Applied a warm kasbah sandstone tint to the existing wall, plaster, and trim
  PBR materials at runtime; normal and roughness maps remain active.
- Kept the fort at the sourced 28,218-triangle geometry budget. No detailed
  mesh is used for player collision; the existing shared rampart proxies remain
  authoritative.
- Selected the 1K set for hero-distance tablet rendering instead of shipping
  the source 4K/8K texture payload.

The source was retrieved on 2026-08-14 from the official Poly Haven API/CDN.
