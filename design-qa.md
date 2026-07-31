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
