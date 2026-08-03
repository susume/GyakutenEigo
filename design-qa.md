# QuizStrike public homepage — design QA

## Visual truth

- Original homepage direction: `C:\Users\admin\Desktop\2026-08-03 08_30_02-GyakutenEigo.png`
- Supplied logo: `C:\Users\admin\Downloads\logo.png`
- Supplied quiz panel: `C:\Users\admin\Desktop\2026-08-03 09_10_50-ChatGPT.png`
- Supplied preparation/shop screen: `C:\Users\admin\Desktop\2026-08-03 09_08_42-ChatGPT.png`
- Supplied gameplay screen: `C:\Users\admin\Desktop\2026-08-03 09_10_19-ChatGPT.png`
- Desktop implementation capture: `C:\Users\admin\Documents\Quiz version CS 1 . 6\design-qa-assets\public-home-desktop.png`
- Mobile implementation capture: `C:\Users\admin\Documents\Quiz version CS 1 . 6\design-qa-assets\public-home-mobile.png`
- Full implementation capture: `C:\Users\admin\Documents\Quiz version CS 1 . 6\design-qa-assets\public-home-full.png`

## Viewport and state

- Desktop implementation: 1440 × 1000 CSS px; captured image is 1425 × 990 px because the browser capture excludes the scrollbar gutter.
- Mobile implementation: 390 × 844 CSS px; captured image is 375 × 811 px because the browser capture excludes the scrollbar gutter.
- State: public homepage at scroll top, no menu open, Answer step selected in the round loop.
- The supplied screens are used as direct product evidence inside the Answer / Earn / Compete loop; the supplied logo is used in the homepage header and footer.

## Comparison evidence

- The implementation keeps the dark navy foundation, tactical linework, cyan information accents, blue/red team cues, restrained gold, and supplied QuizStrike arena artwork.
- The supplied QuizStrike Classroom logo is visible in the desktop and mobile header, with a cropped presentation that preserves the full-color wordmark inside the compact navigation height.
- Answer uses the actual quiz panel, including the live question, answer choices, reward amount, timer, and minimap.
- Earn uses the actual preparation/shop screen, including money, snowballs, launchers, vest, speed boots, and the preparation timer.
- Compete uses the actual first-person arena screen, including the minimap, round timer, weapon, team, money, gear, and snowball HUD.
- Desktop and mobile captures show no horizontal overflow, no clipped primary actions, and no headline taking over the entire mobile viewport.

## Required fidelity surfaces

- Typography: the existing system sans stack is retained for product consistency; display text is reserved for headlines while controls and evidence panels use readable UI sizing.
- Layout: desktop uses an asymmetric editorial grid; mobile recomposes to a single column and keeps the navigation stable.
- Tokens: dark navy is the base; cyan denotes information, green denotes start/success, red and blue distinguish teams, and gold is reserved for rewards and competition cues.
- Assets: `apps/web/public/assets/quizstrike-logo.png`, `quizstrike-actual-quiz.png`, `quizstrike-actual-preparation.png`, and `quizstrike-actual-gameplay.png` are copied from the supplied local files. The existing `quizstrike-classroom-hero.png` remains the hero artwork.
- Copy: homepage messaging explains the real answer → earn → compete loop, teacher controls, six-character join code, confirmed modes, and answer-powered game economy.

## Interaction and runtime checks

- Tested desktop Teacher Login action: `/quiz-strike`.
- Tested hero Join a Game action: `/join`.
- Tested Quiz-Strike competition action: `/quiz-strike`.
- Tested mobile Menu toggle: `aria-expanded="true"`, `data-open="true"`, six visible menu actions.
- Tested How It Works in-page navigation and all Answer / Earn / Compete tabs.
- Verified tab assets: quiz → `/assets/quizstrike-actual-quiz.png`, preparation → `/assets/quizstrike-actual-preparation.png`, gameplay → `/assets/quizstrike-actual-gameplay.png`.
- Browser console errors: none observed.
- `npm run typecheck -w @quizstrike/web`: passed.
- `npm run build`: passed.
- `npm test`: passed — 83 shared, 31 server, and 135 web tests.
- Lint: no lint script is defined in the repository package scripts.

No remaining P0, P1, or P2 visual mismatches were found.

final result: passed
