# Local SpeakCheck avatar

Place your licensed model at **apps/web/public/assets/speaking/avatar/default.vrm**.
Vite serves it as `/assets/speaking/avatar/default.vrm`. No model is bundled: the
repository contained no VRM file, and no third-party character was downloaded.
The existing partner image is shown automatically until a usable model is added.

Use a VRM 0.x or VRM 1.0 humanoid supported by the installed @pixiv/three-vrm 3.5.5.
The model needs a head bone and visible geometry. Prefer a self-contained GLB/VRM
with embedded textures, a standard humanoid rig, and standard `blink`, `aa`, `ih`,
`ou`, `ee`, `oh` expression presets. Separate `blinkLeft`/`blinkRight`, a single
vowel, custom `mouthOpen`/`jawOpen`, and a humanoid jaw bone have fallbacks. Missing
expressions remain optional; a model without mouth shapes or a jaw cannot move
its mouth. Standard neutral is the zero-weight/rest pose.
Export ordinary uncompressed meshes/textures; decoder-dependent Draco, Meshopt,
and KTX2 assets are not configured in this renderer.

Choose a lightweight classroom-appropriate character (ideally under 5 MB, modest
polygon count, few materials, and 1K textures). Confirm that its licence permits
your intended classroom/commercial use and web redistribution. Keep the licence,
author attribution, and any required notices alongside the model. Embedded VRM
metadata alone does not automatically grant permission to redistribute it.

Models and any referenced resources must be hosted on this application's origin.
The loader rejects external HTTP resources. There are no avatar-service calls,
additional credentials, or per-use charges. Speech continues using the existing
browser SpeechSynthesis voices; their availability/offline support depends on
the browser and OS. This feature does not change voice selection.

Configure additional local models/fallbacks in
`apps/web/src/features/speaking/avatar/speakingAvatars.ts` when needed. No teacher
avatar-management UI is included.

See `docs/speaking-avatar.md` for behavior, lifecycle, verification, and limits.
