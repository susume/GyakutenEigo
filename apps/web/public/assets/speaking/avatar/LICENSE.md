# Bundled SpeakCheck character

- Model: **VRM1_Constraint_Twist_Sample**, model version **v1.0.1**, VRM **1.0**.
- Creator/copyright: **pixiv Inc.**, **(c) 2022 pixiv Inc.**
- Retrieved: **2026-10-07**.
- Original creator's distribution: [pixiv/three-vrm model file](https://github.com/pixiv/three-vrm/blob/1b4fc0cc7ef39a49d62bb7a66dcfeca8f65316f7/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm).
- Additional official description: [VRM Consortium sample README](https://github.com/vrm-c/vrm-specification/blob/94e82dd346fa6cf0337c4421728640e5252dd38e/samples/VRM1_Constraint_Twist_Sample/README.md).
- Model licence: [VRM Public License 1.0](https://vrm.dev/licenses/1.0/), together with the creator's settings embedded in the file.

The model's embedded licence settings were inspected from the original source
before downloading the complete asset. The installed file preserves them:

```json
{
  "authors": ["pixiv Inc."],
  "copyrightInformation": "(c) 2022 pixiv Inc.",
  "licenseUrl": "https://vrm.dev/licenses/1.0/",
  "avatarPermission": "everyone",
  "commercialUsage": "corporation",
  "allowRedistribution": true,
  "modification": "allowModificationRedistribution",
  "creditNotation": "unnecessary",
  "allowAntisocialOrHateUsage": false
}
```

VRM Public License 1.0 Sections 1(11), 1(13), and 2(a)(1) expressly cover public
distribution/making the VRM available, animation with sound in an application,
and the rights enabled by those settings. Corporate commercial use and original
or modified redistribution are enabled. Therefore bundling the file in this
software and serving it to end-user browsers are permitted. This is the model's
VRM Public License, rather than an assumption based on the code repository's MIT
licence or a claim that the model is CC0.

On-screen attribution is **not required** (`creditNotation: unnecessary`). We
preserve this courtesy credit and the copyright/source/licence notices. The
licence's prohibition on antisocial/hate usage remains applicable. It provides
the model as-is without warranties (Section 4), does not grant endorsement or
trademark rights, and prohibits restricting recipients' licensed rights.

## Installed variant and integrity

`default.vrm` contains losslessly recompressed PNGs and repacked GLB buffer views.
Every decoded texture pixel, texture resolution, non-image buffer view, mesh,
rig, expression, constraint, spring bone, and licence setting is preserved.
No geometry simplification, texture resizing, quantization, Draco, Meshopt, or
KTX2 conversion was performed. The model retains the same licence and settings.

- Original: **10,776,032 bytes**, SHA-256
  `12c2b97e95e700783a6a550dc0eee2d7880aeedccef9ae67bc4c5a2f0f2631a2`.
- Installed: **8,568,504 bytes** (8.57 MB / 8.17 MiB), SHA-256
  `dfef02a40993742d9cca8939df692dcfac960dd0ed90cef87c1ce5e443959be9`.

Reproduce from the pinned original with the repository's already installed Sharp
dependency: `node scripts/compact-speaking-avatar.mjs source.vrm apps/web/public/assets/speaking/avatar/default.vrm`.
The script checks decoded pixel equality before writing. The original binary is
not bundled alongside the optimized one.
