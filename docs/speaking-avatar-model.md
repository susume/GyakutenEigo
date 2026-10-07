# Bundled SpeakCheck VRM: selection and validation

Validated and retrieved on **2026-10-07**. The installed character is
**VRM1_Constraint_Twist_Sample v1.0.1**, created by **pixiv Inc.**, copyright
**(c) 2022 pixiv Inc.** It uses **VRM 1.0** and the standard humanoid rig.
The friendly stylized character wears a plain white T-shirt. Its age is not
specified by the creator; it looks youthful, rather than like a photorealistic
professional adult. This is the main visual compromise in the selection.

## Source and permission

The original creator distributes it in
[pixiv/three-vrm](https://github.com/pixiv/three-vrm/blob/1b4fc0cc7ef39a49d62bb7a66dcfeca8f65316f7/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm),
pinned to commit `1b4fc0cc7ef39a49d62bb7a66dcfeca8f65316f7`.
The [VRM Consortium sample description](https://github.com/vrm-c/vrm-specification/blob/94e82dd346fa6cf0337c4421728640e5252dd38e/samples/VRM1_Constraint_Twist_Sample/README.md)
also identifies the pixiv copyright and VRM Public License 1.0.

Before downloading the complete binary, the GLB header and JSON licence metadata
were streamed from the original distribution and the remaining download was
cancelled. The full [VRM Public License 1.0](https://vrm.dev/en/licenses/1.0/)
was checked with its explicit settings: `avatarPermission: everyone`,
`commercialUsage: corporation`, `allowRedistribution: true`,
`modification: allowModificationRedistribution`, `creditNotation: unnecessary`.
The licence covers distribution/public availability and avatar animation with
sound in applications. These settings permit corporate commercial use, software
embedding and serving the file to end-user browsers, including this modified
lossless variant. This permission comes from the model licence and settings,
not the repository's code licence.

On-screen attribution is not required. Courtesy credit, copyright, source,
licence settings, retrieval date, integrity hashes, conditions and optimization
details are preserved in
[LICENSE.md](../apps/web/public/assets/speaking/avatar/LICENSE.md).
The antisocial/hate restriction and other VRM Public License conditions remain
applicable. No endorsement by pixiv is implied.

## Candidates considered before full download

Unknown fields below were unavailable from the accessible original source.
Those assets were not downloaded to fill in missing information.

| Candidate / creator / original source | Licence and intended-use permission | Credit | Version / original size | Decision |
| --- | --- | --- | --- | --- |
| **VRM1_Constraint_Twist_Sample**, pixiv Inc.; [original file](https://github.com/pixiv/three-vrm/blob/1b4fc0cc7ef39a49d62bb7a66dcfeca8f65316f7/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm) | VRM Public License 1.0; explicit corporate commercial use, redistribution and modified redistribution. Covers application use and public availability. | Unnecessary | VRM 1.0, v1.0.1; 10,776,032 bytes | Selected: neutral clothes, moderate geometry, complete facial rig, clear original ownership and redistribution grant. |
| **Seed-san**, VirtualCast Inc.; [official sample](https://github.com/vrm-c/vrm-specification/tree/master/samples/Seed-san) | VRM Public License 1.0; corporate commercial use, redistribution and modified redistribution explicitly enabled in original metadata. | Required by metadata | VRM 1.0; 10,917,800 bytes | Safe licence, but youthful science-fiction styling and a large mechanical accessory were less suitable for a neutral conversation partner. 45,058 triangles, 17 materials. |
| **Albert_v01**, yomox9; [creator's BOOTH listing](https://yomox9.booth.pm/items/2306138) | Creator explicitly describes CC0, including commercial use. CC0 permits embedding/redistribution. | Not required under CC0 | VRM version/file size unverified; listed ZIP approximately 91.2 MB | More adult researcher/uniform appearance, but the original downloadable listing was private/sign-in gated during inspection. No mirror was used and the actual asset could not be validated. |
| **AvatarSample_C**, VRoid Project / pixiv; [original VRoid Hub](https://hub.vroid.com/characters/1248981995540129234/models/8640547963669442173) | Original commercial/redistribution settings also refer to [VRoid Preset A–Z conditions](https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z), including fee-based redistribution and character-service restrictions. These require additional interpretation for a commercial embedded product. | Depends on original settings/conditions; not fully established | VRM 0.x; file size unverified | Rejected for this bundle: chose the sample's explicit grant rather than infer compatibility with additional restrictions. |
| **100Avatars collection**, Polygonal Mind; [creator repository](https://github.com/PolygonalMind/100Avatars) and [releases](https://github.com/PolygonalMind/100Avatars/releases) | Releases state CC0, while README includes a restriction against selling unchanged avatars. The relationship between these terms was unresolved. | CC0 itself does not require attribution | Individual VRM versions/sizes unverified | Rejected for this bundle: conflicting statements and strongly cartoon/fantasy styling. No full model download. |

## Installed asset and safe optimization

Exact path: **`apps/web/public/assets/speaking/avatar/default.vrm`**.
Browser URL: **`/assets/speaking/avatar/default.vrm`**.
It is self-contained, with 3 source meshes, 36,470 triangles, 13 source materials,
and 19 embedded PNGs. There are no external texture, buffer, decoder, or service
dependencies. The original is 10,776,032 bytes; the installed variant is
**8,568,504 bytes (8.57 MB / 8.17 MiB)**, a **20.5%** reduction.

[compact-speaking-avatar.mjs](../scripts/compact-speaking-avatar.mjs) uses the
already installed Sharp dependency to recompress PNGs without palette
quantization. It decodes each original and replacement and checks exact pixel,
channel and dimension equality before writing. Non-image buffer view contents
are copied byte-for-byte; indices, rig, geometry, licence metadata, expressions,
constraints and spring bones are preserved. Buffer offsets are repacked and JSON
is minified. No geometry simplification or texture resizing was performed.
The unused-in-rendering embedded thumbnail is retained. GPU texture memory is
unchanged by this download-size optimization.

The source and installed SHA-256 hashes are recorded in LICENSE.md. The original
temporary binary is removed after validation, leaving one distributable model.
No package, lockfile or paid service changes are required.

## Actual character checks

The real bundled file was served by Vite preview and loaded by the production
Three/VRM renderer in Chrome on Windows. Browser screenshots were inspected at
**1366×768**, **768×1024** and **390×844**, including idle, speaking, listening,
thinking and native TTS playback. Checks confirmed:

- `data-avatar-status="ready"`; the fallback disappears; one live canvas.
- No console errors, failed resources or missing textures in the real-model
  lifecycle test; transcript thumbnails remain static.
- Centered chest/shoulders portrait with the whole head, hair and shoulder edges
  visible, some top space and arms lowered. No model-specific camera or rig
  adjustments were needed. The broad desktop card naturally leaves side space.
- Subtle breathing/head/gaze motion and natural irregular blinks, without obvious
  shaking. Listening keeps the mouth closed; thinking keeps a gentle expression
  and continues rendering.
- Standard non-binary `aa`, `ih`, `ou`, `ee`, `oh` and `blink` morph bindings all
  affect the real GPU facial uniforms. Happy/relaxed expressions allow these
  facial channels. No expression fallback changes were necessary.
- Greeting/reply/replay animate the mouth; end/cancel release it to zero.
  Recording and waiting-for-reply tests use fake microphone/API/TTS boundaries
  for reproducibility, while loading/rig/geometry/rendering remain real.
- A separate test uses actual browser SpeechSynthesis and observes native
  utterance start/end events, real mouth movement, replay, natural completion
  and Stop playback. It skips only on systems with no installed local English
  voice; it ran successfully on this host.
- Mobile/tablet controls and microphone remain reachable; conversation content
  scrolls; no horizontal overflow. Existing fallback, support, short-desktop,
  Finish and feedback tests still cover their earlier cases.

## Performance, test scope and limits

Observed rendering was approximately **30 FPS**, matching the intended cap.
The GPU probe counts one clear per draw and one unique WebGL context; the same
canvas survives state changes and viewport resizing. Animation updates the rig
outside React; the React component has no per-frame state setter or animation
loop. The shared conversation timer may still render its ordinary UI updates.
No obvious responsiveness or resource runaway was observed in this environment.

Browser tests simulate the hidden flag and dispatch `visibilitychange`, then
assert that draw counts stop and resume on visibility restoration. Renderer
units also verify cancellation and bounded resume deltas. A separate attempt
to check actual window hiding did not change `document.hidden` in this automated
Chrome environment, even in headed mode; Playwright's page initialization forces
focus emulation. Therefore actual OS tab/window visibility is not claimed as
visually verified here. The handler and renderer suspension are verified.
This is a desktop environment check, not a physical Chromebook or iPad benchmark.
DPR remains capped at 1.5, with no shadows or postprocessing.

Required root checks: `npm run typecheck`, `npm run test`, `npm run build`.
The root suite has **719 passed / one existing skip (720 total)**.
Focused avatar units have **27 passed**. The focused Playwright suite has
**7 passed**, comprising the five existing fallback/layout cases and two new
real-model/native TTS cases. Root typecheck/build and focused lint also passed.
Run it with:

```sh
npm run test:e2e -w @quizstrike/web -- e2e/speaking-student-layout.spec.ts --project=desktop-chrome
```

Performance JSON, screenshots and verification logs are local ignored artifacts.
The existing shared Three chunk remains over Vite's 500 kB warning threshold;
the avatar renderer is lazy-loaded. The earlier four outdated teacher/join/home
selectors in `speaking.spec.ts` are documented in speaking-avatar.md.

Remaining limits: the character is stylized/youthful and slightly above the
preferred download size; weak devices still need physical testing. Mouth motion
is procedural rather than phoneme-accurate. Browser/OS voice availability and
offline behavior vary. Avatar loading/rendering introduces no paid service or
per-use charge. Gemini, recording, assessment, support, retry, reporting and
teacher behavior were not changed by installing this model.
