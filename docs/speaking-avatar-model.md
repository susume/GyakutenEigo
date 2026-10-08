# Bundled SpeakCheck VRM: Mika 1.0

Installed on **2026-10-09** from the user-provided **Mika 1.0.vrm**. The user
created the character in VRoid Studio and explicitly requested replacing the
previous bundled VRM. The export identifies **Mika**, version **1.0**, creator
**Peter Hoang**, generator **VRoid Studio 2.14.0**, and **VRM 1.0**.

## Installed asset

- Path: `apps/web/public/assets/speaking/avatar/default.vrm`.
- Browser URL: `/assets/speaking/avatar/default.vrm`.
- Size: **17,733,740 bytes** (17.73 MB / 16.91 MiB).
- SHA-256: `bf69531bed0b043fec4039b58eaa7cd6c7607448a2989b2ee56ca63aa2edb84f`.
- Geometry: **3 meshes**, **43,346 triangles**, **13 source materials**.
- Textures: **23 embedded PNGs**, up to **2048 x 2048**, including the thumbnail.

The installed asset is an exact copy of the supplied export. No optimization,
mesh conversion, texture resizing, expression editing or metadata rewriting was
performed. All buffers and textures are embedded; no external resources or
decoder-dependent compression are required. The editable `Mika model V1.vroid`
file remains the author's source project and is not served as a runtime asset.

Creator credit and the restrictive licence settings from the export are recorded
in [LICENSE.md](../apps/web/public/assets/speaking/avatar/LICENSE.md). The previous
pixiv sample's permissions and attribution no longer describe this asset.

## Renderer compatibility

Mika has a standard humanoid rig with head, chest, eyes and limb bones. The face
has 57 morph targets and non-binary `blink`, `aa`, `ih`, `ou`, `ee`, `oh`, `happy`
and `relaxed` presets. Its smile/relaxed presets do not block mouth or blink
animation. The installed renderer can use these bindings without runtime changes.

The browser GPU probe in `speaking-student-layout.spec.ts` uses Mika's exported
facial indices: `blink = 13`, `aa/ih/ou/ee/oh = 39/40/41/42/43`, `happy = 3`,
`relaxed = 2`. Asset tests check model identity, preserved creator settings,
embedded resources, valid facial bindings and the recorded hash.

## Verification

Run the repository checks and the existing avatar browser suite:

```sh
npm run typecheck
npm run test
npm run build
npm run test:e2e -w @quizstrike/web -- e2e/speaking-student-layout.spec.ts --project=desktop-chrome
```

The real-model cases exercise loading, rendering, blink/vowel GPU weights,
speech/replay/stop, listening/thinking, desktop/tablet/mobile layout and renderer
lifecycle. The native TTS case uses actual browser SpeechSynthesis and skips only
when no local English voice is installed. Screenshots and performance reports
are local ignored test artifacts.

Verified on **2026-10-09**: root typecheck/build passed, root tests passed with
**735 passed / one existing skip**, focused lint passed, and all **12** tests in
the avatar/student-layout Playwright suite passed in Chrome on Windows. Desktop
1366 x 768, tablet 768 x 1024 and phone 390 x 844 screenshots were inspected:
Mika faces forward with the complete head/hair visible and student controls
reachable. Real GPU checks observed all five mouth shapes, a full blink, release
to a closed mouth, one WebGL context and approximately **30.04 FPS**. Native TTS,
replay/cancellation, fallback and lifecycle checks passed. The built runtime asset
has the same SHA-256 as the supplied export.

The larger file increases the initial download relative to the previous model.
Physical low-power device performance and slower networks require separate
validation. Mouth motion remains procedural rather than phoneme-accurate.
