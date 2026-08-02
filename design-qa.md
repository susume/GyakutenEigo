# Wing Reference Refinement — Design QA

## Visual truth

- Angel Wings source: `C:\Users\hungb\Downloads\wings.png`
- Demon Wings source: `C:\Users\hungb\Downloads\devils wings.jpg`
- Angel implementation: `C:\Users\hungb\OneDrive\Documents\GitHub\GyakutenEigo\design-qa-assets\angel-wings-implementation.png`
- Demon implementation: `C:\Users\hungb\OneDrive\Documents\GitHub\GyakutenEigo\design-qa-assets\demon-wings-implementation.png`
- Mouthless Girl implementation: `C:\Users\hungb\OneDrive\Documents\GitHub\GyakutenEigo\design-qa-assets\girl-mouthless-implementation.png`
- Mouthless Boy implementation: `C:\Users\hungb\OneDrive\Documents\GitHub\GyakutenEigo\design-qa-assets\boy-mouthless-implementation.png`
- Focused comparisons:
  - `C:\Users\hungb\OneDrive\Documents\GitHub\GyakutenEigo\design-qa-assets\angel-wings-comparison.png`
  - `C:\Users\hungb\OneDrive\Documents\GitHub\GyakutenEigo\design-qa-assets\demon-wings-comparison.png`

## Viewport and normalization

- Browser viewport and implementation captures: 1366 × 768 CSS px at device pixel ratio 1.
- Angel source: 480 × 599 px.
- Demon source: 980 × 980 px.
- Comparison crops normalize the isolated source silhouette and the 744 × 386 preview region to equal 744 × 386 panels. Browser chrome and the customization panel are excluded from the focused comparisons.
- State: Blue Team waiting-room creator, rear three-quarter Back preview, Boy head, Angel Wings or Demon Wings selected. Separate Head previews verify both Boy and Girl without mouth geometry.

## Full-view comparison evidence

- Angel Wings now read as two tall white feather fans with a raised crown, layered secondary feathers, and long pointed primaries sweeping outward and down.
- Demon Wings now read as broad ruby bat wings with black perimeter structure, radial ribs, high spear tips, notched trailing edges, and lower hooked lobes.
- Both silhouettes remain centered on the shoulder-blade mount and leave the team uniform visible.
- Boy and Girl retain eyes, brows, nose, blush/hair details, and hair animation controls without a visible mouth shape.

## Focused comparison evidence

- `angel-wings-comparison.png` confirms the source and implementation share the arched shoulder profile, overlapping feather layers, bilateral symmetry, and long tapered outer feathers.
- `demon-wings-comparison.png` confirms the source and implementation share the red membrane, dark frame, tall upper point, radial webbing, notched outer edge, and lower lobe.
- The implementation intentionally translates photographic/illustrated feather texture into low-poly QuizStrike geometry rather than reproducing raster detail.

## Required fidelity surfaces

- Fonts and typography: unchanged and outside the supplied wing references; the existing creator typography remains intact.
- Spacing and layout rhythm: unchanged. Enlarged wings remain inside the preview frame; the Demon mount was lowered after QA to clear the top edge.
- Colors and visual tokens: Angel feathers are warm off-white. Demon membranes are deep ruby with neutral dark ribs and a small team-color hub; Blue uniform identity remains clear.
- Image/asset fidelity: the source silhouettes are represented with real Three.js meshes and shared geometry appropriate to the existing character pipeline. No screenshot texture or placeholder asset is used.
- Copy and content: existing cosmetic names and descriptions are unchanged. Boy and Girl mouth geometry is removed without adding explanatory UI copy.

## Findings

- No remaining P0, P1, or P2 visual mismatches.
- [P3] Feather surfaces are intentionally faceted and cleaner than the photographic reference.
  - Impact: visible only at close lobby-preview range.
  - Disposition: accepted to preserve the established low-poly QuizStrike art style and shared-geometry performance.

## Comparison history

1. Initial pass: Angel Wings were too horizontal and compact.
   - Fix: raised the outer feather roots, lengthened the primaries, and rebuilt the wing as primary, secondary, and covert layers.
   - Post-fix evidence: `angel-wings-implementation.png`.
2. Second pass: both wing sets were still narrower than the references; the enlarged Demon tip touched the preview edge.
   - Fix: expanded both silhouettes, added broader Demon membrane sectors and ribs, and lowered the Demon mount.
   - Post-fix evidence: both final focused comparison images.

## Interaction and runtime checks

- Tested Head and Back tab switching, Boy/Girl selection, Angel/Demon selection, immediate 3D replacement, selected states, and preview reset.
- Browser alerts: none.
- Browser console errors: none.

final result: passed

# Teacher Live Setup — Sticky Rail QA

## Update

- Locked the desktop live setup rail in place while the right-side setup panel scrolls.
- Kept the existing horizontal setup navigation behavior for smaller screens.
- The rail uses the dashboard header offset so it remains visible beneath the QuizStrike header.

## Verification

- Advanced Settings scroll test confirmed the rail remains visible at the top of the viewport while the main panel moves.
- Game Mode, Arena, Advanced Settings, and Back to Library remain visible and usable during the scroll.
- Browser console errors and warnings: none.
- `npm run typecheck -w @quizstrike/web`: passed.
- `npm run build`: passed.

final result: passed

# Teacher Live Setup — Real Arena Map Assets QA

## Update

- Replaced the earlier generated map mockups with the supplied Desert Citadel, The Iron Junction, and Temple Runoff screenshots.
- Removed the screenshots' outer backgrounds while preserving the original map pixels.
- Added a subtle cyan edge/shadow so the transparent map silhouettes remain readable on the navy card surface.
- Changed the teacher-facing card label from `Temple Runoff 2.0` to `Temple Runoff` without changing the authoritative game map name.

## Verification

- All three supplied map assets load successfully in the browser.
- The visible labels are Desert Citadel, The Iron Junction, and Temple Runoff.
- `Temple Runoff 2.0` is no longer present in the teacher map selector.
- Browser console errors and warnings: none.
- `npm run typecheck -w @quizstrike/web`: passed.
- `npm run build`: passed.

final result: passed

# Teacher Live Setup — Arena Map Preview QA

## Update

- Replaced the target icons and flat map-color treatments with three map preview images.
- Added consistent top-down previews for Desert Citadel, The Iron Junction, and Temple Runoff 2.0.
- Moved each map name into a dedicated title row directly beneath its image.
- Preserved selected-state styling, keyboard/button semantics, and map selection behavior.

## Verification

- All three map preview images loaded successfully in the browser.
- Selecting The Iron Junction updates the selected map state correctly.
- Arena Rules remains available below the map cards.
- Browser console errors and warnings: none.
- `npm run typecheck -w @quizstrike/web`: passed.
- `npm run build`: passed.

final result: passed

# Teacher Live Setup — Arena Rules Grouping QA

## Update

- Moved `Team Assignment` into the Arena panel for Flag mode.
- Moved `Flag Hold Time` into the Arena panel for Flag mode.
- Moved `Zombies Chosen` into the Arena panel for Zombie mode.
- Kept rounds, round time, player capacity, economy, supplies, and player experience in Advanced Settings.
- Arena Rules appear only when the selected mode has arena-specific controls, so Tag stays clean.

## Verification

- Flag → Arena shows Team Assignment and Flag Hold Time.
- Flag → Advanced Settings no longer shows Team Assignment or Flag Hold Time.
- Zombie → Arena shows Zombies Chosen and keeps the existing zombie-head asset.
- Advanced Settings still shows Quiz Economy, Weapons / Supplies, and Player Experience.
- Browser console errors and warnings: none.
- `npm run typecheck -w @quizstrike/web`: passed.

final result: passed

# Teacher Live Setup — Two-Pane Layout QA

## Visual target

- User reference: `C:\Users\hungb\OneDrive\Pictures\Screenshots\Screenshot 2026-08-02 134444.png`
- User reference continuation: `C:\Users\hungb\OneDrive\Pictures\Screenshots\Screenshot 2026-08-02 134454.png`
- Target intent: reclaim the empty left navigation column as a live setup rail; clicking Game Mode, Arena, or Advanced Settings swaps the right-side content panel.

## Implemented

- Live setup replaces the global Library / Reports / Settings rail with a focused three-item setup rail while the setup is active.
- Game Mode, Arena, and Advanced Settings render as separate right-side panels and preserve the selected quiz and settings state.
- Removed the redundant Step 2 caption, panel subtitles, mode-card descriptions, and arena-card captions from the visible layout.
- Preserved accessible descriptions through `aria-label` values on the mode and arena controls.
- Preserved the real Advanced Settings controls and the existing zombie-head asset.
- Responsive behavior collapses the setup rail into a horizontal navigation bar on smaller screens.

## Verification

- Browser-tested the local teacher flow at `http://127.0.0.1:5173/quiz-strike`.
- Clicked all three setup rail items and confirmed the right panel changes without a route reload.
- Selected Zombie and confirmed `/assets/zombie/zombie-head.png` remains the rendered asset.
- Confirmed Flag-only team settings and Advanced Settings controls remain available.
- Browser console errors and warnings: none.
- `npm run typecheck -w @quizstrike/web`: passed.
- `npm run build`: passed. Existing environment warnings remain for Node 20.16 versus the repository's Vite requirement of Node 20.19+.

final result: passed

# QuizStrike Teacher Workspace — Design QA

## Visual target

- Approved dark/navy teacher dashboard direction: `C:\Users\hungb\.codex\generated_images\019fc061-564f-73e3-a7aa-4c8ddce7f2bd\exec-52b0da0c-ea4a-4db4-931d-e26500968bbf.png`
- Live setup reference with expanded advanced settings: `C:\Users\hungb\.codex\generated_images\019fc061-564f-73e3-a7aa-4c8ddce7f2bd\exec-86b98505-4d16-4401-84d9-ead639d9cda1.png`
- Zombie asset used in the implementation: `C:\Users\hungb\OneDrive\Documents\GitHub\GyakutenEigo\apps\web\public\assets\zombie\zombie-head.png`

## Implemented surfaces

- Dark teacher shell with persistent QuizStrike brand, Library / Reports / Settings navigation, coral primary actions, cyan selection states, and navy panels.
- Quiz library with featured quiz, search, clear Play Live / Edit Set actions, folder breadcrumbs, and a lightweight drag-to-folder hint.
- Quiz workspace with the selected quiz context, paste-to-quiz builder, manual question creation, question editing, question deletion, difficulty, and explanation metadata.
- Live setup with exactly three visible game modes: Zombie, Tag, and Flag. Zombie uses the existing game zombie-head asset; Tag and Flag use the existing icon system.
- Advanced Settings remains open with round/time/player settings, quiz economy, weapons/supplies, and player experience toggles; mode-dependent team and arena rules live in Arena.

## Runtime verification

- Local app verified at `http://127.0.0.1:5173/` in the in-app browser.
- Exercised empty and populated library states, quiz creation, manual question creation, question edit mode, Edit Set routing, live setup, Zombie / Tag / Flag selection, and Flag-only team controls.
- Confirmed the Zombie mode image source is `/assets/zombie/zombie-head.png`.
- Confirmed no fake “time per question” or “question order” controls were introduced.
- Browser console errors and warnings: none.

## Findings

- Fixed inherited legacy white surfaces in the dashboard refresh row, setup header, quiz creation form, and Advanced Settings content so the implemented flow stays visually consistent with the approved dark direction.
- Advanced Settings groups are intentionally grouped rather than hidden behind presets; smaller screens collapse the groups into a readable single-column layout.
- Tag and Flag retain their existing gameplay values (`classic` and `flag`) behind the scenes so the server behavior remains compatible while the teacher-facing labels match the approved product language.

final result: passed
