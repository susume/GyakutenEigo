# Student speaking layout and environments

Implemented and inspected on 2026-10-09 in the existing GyakutenEigo app, using the supplied screen and the installed Mika VRM as the starting point.

## Changes and visual checks

1. **Desktop conversation — verified.** The header is compact, the portrait occupies its own grid row, and the fixed-height HTML dialogue sits below it. A small dock holds Conversation, the primary microphone, Context and Help when permitted. Replay is beside the utterance; the duplicate dock Replay was removed. The support sidebar is 320–340px wide. [Before/after at 1366×768](before-after-desktop.jpg), [desktop and phone](desktop-and-phone.jpg).
2. **Phone, tablet and landscape — verified.** Below 1101px wide, or at 480px high and below, support becomes a drawer. It ends above the microphone dock. Phone headers separate the logo/timer/Finish row from the mode/title row, including Japanese text. Short landscape screens place the portrait beside the dialogue. [320×568 assessment](after-small-assessment.jpg), [844×390 landscape](after-landscape.jpg), [390×844 Context](after-phone-context.jpg).
3. **References, history and long replies — verified.** Menus and workplace reference sheets remain in Context. The history launcher is in the dock, mobile drawers close one another, and Escape restores focus to the invoker. Long replies and hints scroll inside the dialogue card; they leave the controls available. Hint dismissal returns focus to Help. [Workplace reference sheet](after-workplace.jpg).
4. **Scene selection — verified.** The previous selector enabled only the tourist plaza. It intentionally kept food, school and workplace tasks neutral because catalog illustrations were unsuitable as environments. This was independent of the Mika model replacement. All 79 built-in templates now select appropriate environment-only artwork by stable source-template ID. Explicit same-origin scene overrides retain precedence; unknown/custom tasks without an environment retain the neutral fallback.

## Environment assets

Seven empty photographic environments were generated with the built-in ImageGen tool on 2026-10-09, then optimized with Sharp to 1536px-wide WebP at quality 78. They contain no people and leave room for the live avatar. Files live in `apps/web/public/assets/speaking/`. Only the selected scene is requested.

| File | Used for | Bytes |
| --- | --- | ---: |
| practice-cafe.webp | Food/restaurant tasks and social plans | 90,210 |
| practice-school.webp | School and general conversation | 68,122 |
| practice-shop.webp | Shopping and workplace retail | 76,148 |
| practice-station.webp | Train and transport tasks | 86,584 |
| practice-showroom.webp | Workplace automotive tasks | 64,324 |
| practice-hotel.webp | Workplace hotel tasks | 94,646 |
| practice-office.webp | Workplace office tasks | 68,132 |

New assets total 548,166 bytes. The existing 150,990-byte `practice-plaza.webp` is retained for street directions, tourism and culture tasks. Catalog illustrations, maps, menus and reference data are kept separate from scene artwork.

## Validation

- `npm test`: 736 passed, 1 existing optional Gemini smoke-test skip, 0 failed. All 378 web tests rerun after the final changes and passed.
- `npm run typecheck`: passed; web typecheck, including E2E TypeScript, rerun after the final control changes and passed.
- `npm run build`: passed after final changes. The existing large Three.js chunk warning remains.
- Live in-app browser: 1920×1080, 1366×768, 1280×720, 1024×768, 768×1024, 390×844, 360×640, 320×568, 960×540, 1366×600 and 844×390. Measured page bounds and hit-tested primary controls; no page overflow or obstructed microphone/Finish controls.
- English and Japanese headers inspected at 320×568. Context opening, tab focus, Escape/invoker restoration, history, hint dismissal and keyboard dialogue scrolling checked in the browser. Café, showroom, retained plaza and neutral scenes inspected with the real Mika renderer.
- Resolver tests check all 79 templates against existing local assets under 200kB, representative scene choices, explicit overrides, unknown templates, reference separation and unsafe paths.
- Existing student browser regression specifications were updated for the café, the single Replay location, the new drawer breakpoint and small/landscape sizes. Their automated Playwright suite was not run in this pass; the live browser checks above are the UI evidence.

The local layout preview uses synthetic session data and a frozen demo timer, leaving real classroom sessions untouched. Finish shows a sample result with no recorded student speech. Recording, transcription, assessment, evaluation and session APIs retain their existing implementation.
