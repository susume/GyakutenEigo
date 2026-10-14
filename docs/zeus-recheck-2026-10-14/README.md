# Zeus follow-up audit — 14 October 2026

The previous pass improved the pacing but retained a cartoon face. This revision
replaces that face with a realistic museum scan and fixes the confirmed audio
and accessibility issues found while reviewing the implementation. The review
uses the requested ages **11–14** as its design lens; it is a developer walkthrough,
not a new playtest with children.

## Findings and repairs

| Step | Finding | Result and evidence |
| --- | --- | --- |
| 1. Meet Zeus | Smaller spheres, exaggerated eyes, and a procedural beard still looked cartoonish. | Replaced the entire face with SMK's Zeus Ammon scan. Natural anatomy, curls, and beard; cropped display stem; neutral lighting; correct STOP orientation. Compare `01-before-model.jpg` and `07-after-desktop-stop.jpg`. |
| 2. Climb and freeze | The chant bag advanced during silent cycles. For seed 0, the first two audible chants could both be `slow`, contradicting the intended variety. | Bag progression now follows the chants players actually hear. Regression coverage checks 257 seeds across 61 audible chants each, including bag boundaries. The quiet climbing intervals, once-per-three-cycles narration, countdown, and stopping allowance remain. |
| 3. Hear the signal | Root-relative audio URLs ignored the site's deployment prefix. A failed download remained cached as `null`. | Audio respects `BASE_URL`. Failed buffers are evicted so a later voiced cycle can retry; the same failed chant does not cause a request every 100 ms. Autoplay blocking and live-offset playback still pass their regression checks. |
| 4. Play comfortably | Reduced-motion mode still tilted and shrank Zeus for 1.1 seconds on defeat. Generic cleanup disposed shared geometry repeatedly and was unsuitable for a cached imported model. | Reduced motion hides Zeus immediately. Cleanup releases owned resources once, preserves cached model geometry, and prevents a late download from attaching after unmount. Failed model loading leaves the independent GO/STOP signal usable. |
| 5. Read and refuel | The new model and credit needed checking around phone controls and question panels. | Desktop 1280×800, portrait 375×812, and landscape 812×375 checked in the running game. No horizontal overflow in portrait. Model stays outside the HUD and controls. Questions retain a separate GO/STOP signal. A correct answer increased energy from 410 to 630. |

## Model and licensing

**Zeus Ammon (KAS1110)** comes from
[SMK — National Gallery of Denmark](https://open.smk.dk/en/artwork/image/KAS1110).
The museum identifies the material as free to use and the artwork as public
domain. Its [use policy](https://www.smk.dk/en/section/use-of-smk-material/)
and [3D collection](https://www.smk.dk/en/article/3d-models/) were checked.

This is a scanned classical sculpture with realistic human anatomy and ivory
stone materials. It has no living-actor skin texture. The former cartoon face
is completely removed. The locally bundled model is **562,008 bytes / 40,000
triangles**, reduced from 399,996 triangles, with no external texture dependency.
The source, license, modifications, and hashes are recorded in
`apps/web/public/assets/zeus/LICENSE.md` and `provenance.json`. Game settings also
link to the museum, in English and Japanese.

Regenerate the model with `scripts/prepare-zeus-model.mjs` and the downloaded
source STL. The original download and intermediate orientation checks are kept
locally in the ignored `.tools/zeus-model-source-2026-10-14/` cache; they are not
part of the shipped asset.

## Verification

- **37 focused tests passed:** shared timing and recovery; audible chant variety;
  audio paths, retry and autoplay handling; narration durations; model parsing
  and size budget; load failure, late completion and repeated cleanup; sky pass,
  phase turns and reduced motion; preferences.
- **Both Zeus server integration tests passed:** STOP-safe questions and looking,
  90% energy retention, learning credit, stale packet rejection, and summit victory.
- Shared build, web/server type checks, production web build, changed-file ESLint,
  and `git diff --check` passed.
- In-app browser walkthrough checked the imported model's `ready` state,
  desktop and phone layouts, teacher pause/resume, questions, refueling, and the
  independent chant switch. The switch was restored after testing.

The production build retains its existing warning about the Three.js chunk's
size. The full Playwright suite was not run. Actual enjoyment still needs a
replay with the children; this audit verifies the implementation and removes
the specific sources of irritation reported by the user.

## Current-run screenshots

All screenshots below were captured and inspected during this follow-up.
The in-app capture stream can lag the live DOM around a phase transition;
screenshots document the visible captured state.

- `01-before-model.jpg` — previous cartoon face during STOP.
- `07-after-desktop-stop.jpg` — replacement scan and STOP cue.
- `08-after-phone.jpg` — portrait course, model, HUD and controls.
- `09-after-settings.jpg` — chant disabled independently; museum credit.
- `10-after-phone-question.jpg` — portrait question with separate STOP cue.
- `11-after-landscape-question.jpg` — landscape question and separate GO cue.
- `12-after-landscape.jpg` — landscape course with model and refueled energy.
