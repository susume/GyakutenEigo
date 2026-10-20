# Shared speaking workspace audit — 20 October 2026

The audit covers the shared student speaking screen used by School English, Workplace English and custom activities. The selected option 1 layout and the supplied train map remain in use. Changes are local and have not been deployed.

## Flow and evidence

1. **Open a speaking task — healthy after fixes.** The question, microphone, Replay and Finish remain reachable. The same screen supports landscape notebooks, portrait tablets and compact screens. The AI role remains visible when the portrait is hidden.

   ![Final shared speaking workspace](../tmp/speaking-workspace-audit/13-final-shared-workspace.png)

   The 1024 × 600 Chromebook check is also saved as `tmp/speaking-workspace-audit/04-chromebook-fixed.png`.

   ![Portrait tablet](../tmp/speaking-workspace-audit/08-portrait-tablet-fixed.png)

   ![Compact screen](../tmp/speaking-workspace-audit/09-compact-fixed.png)

   ![Speaking controls at 125 percent magnification](../tmp/speaking-workspace-audit/12-magnification-fixed.png)

2. **Read, enlarge and zoom context — healthy after fixes.** Context images show no explanatory prose. The controls now sit below the image, leaving the map legend visible. The expanded viewer fits each image's actual aspect ratio instead of assuming the train map's dimensions. Zoom remains available for all context images.

   ![Expanded map](../tmp/speaking-workspace-audit/05-expanded-map-fixed.png)

   ![Inline image zoom with scrollbars](../tmp/speaking-workspace-audit/14-inline-zoom-fixed.png)

3. **Switch Useful English and Conversation — healthy after fixes.** Context tab selection moves keyboard focus into the visible panel. Escape returns focus to the invoking footer action. Short landscape screens put Conversation beside the question. Switching panels no longer moves a focused button before its click completes; the redundant floating support button was removed.

   ![Landscape conversation](../tmp/speaking-workspace-audit/06-landscape-conversation-fixed.png)

   ![Landscape Useful English](../tmp/speaking-workspace-audit/07-landscape-support-fixed.png)

4. **Use other test resources and teacher settings — healthy after fixes.** Text-only reference sheets retain their information and scroll by keyboard on smaller screens. Custom tests with support disabled show only the permitted controls. Listening, processing and AI-speaking labels use reserved space so state changes do not move the question or microphone.

   ![Scrollable Workplace reference sheet](../tmp/speaking-workspace-audit/10-workplace-reference-fixed.png)

   ![Custom test with support disabled](../tmp/speaking-workspace-audit/11-custom-disabled-support-fixed.png)

All screenshots above were captured and visually inspected during this audit using the local production preview in the in-app browser. The preview uses disposable local test accounts and seven-minute sessions. The original before-fix evidence is `tmp/speaking-workspace-audit/01-chromebook-before.png` and `02-context-focus-before.png`; `03-chromebook-fixed.png` was rejected because its session had expired.

## Repairs

- Kept map controls outside the image so station labels and the legend are not covered.
- Replaced fixed viewer dimensions with aspect-ratio fitting and added portrait, landscape and unloaded-image unit coverage.
- Fixed keyboard focus when the Context tab hides its own tab header; added support action relationships for assistive technology.
- Restored scrolling for reference-only tasks.
- Fixed compact landscape Conversation placement and drawer switching during rotation.
- Removed focus-triggered closing that could cancel a pointer click when the layout moved.
- Reserved stable space for speech-state labels and restored the role label on compact layouts.
- Changed the live session's viewport sizing to keep the microphone visible at 125% page magnification; added a dedicated regression check.
- Updated shared UI regression selectors for the new footer actions and image scroll area.
- Refreshed the older connected-flow tests for current task labels, the required student goal, image upload/removal, explicit practice settings and the results screen. Missing context is now checked as an absent Context action instead of an empty drawer.
- Made the native-speech animation check record replay-specific GPU peaks instead of requiring a polling sample to catch a brief open-mouth frame. It still verifies actual movement, a closed mouth after speech, native start/end events and cancellation.

## Validation

- Production web build passed; the existing large-chunk advisory remains.
- Root typecheck, final web/e2e typecheck and focused ESLint passed.
- Web unit suite: **409 passed**.
- Browser coverage: **38 distinct scenarios verified**. The combined run passed 37 tests and failed one timing-sensitive native-speech animation probe. That test passed immediately without a source change; after correcting its sampling to use replay-specific peaks, **three repeat runs passed**. No production avatar behavior was changed for this measurement issue.
- The combined run passed all 16 viewport sizes from 320 × 568 to 1920 × 1080, the 125% magnification check, image fit/zoom, keyboard focus, rotation, long messages, hints, teacher settings and avatar fallback checks. All seven older entry, connected classroom flow, recovery and result checks passed.
- Reproduction: build the web workspace, then run `npm run test:e2e -w @quizstrike/web -- speaking-student-layout.spec.ts speaking-hwg-train-directions.spec.ts speaking.spec.ts`. Logs are saved in `tmp/speaking-workspace-audit-browser-complete.log` and `tmp/speaking-workspace-audit-native-final.log`.
- Current preview pages reported no browser console errors. A brief local connection pause recovered automatically while the full regression suite was active.

## Limits

The responsive checks use Chromium viewport emulation and the in-app browser, not physical iPads or Chromebooks. Synthetic audio and browser speech exercise the UI lifecycle; an actual student's microphone and the external speech-processing service were not tested. Screenshots and keyboard checks do not establish full accessibility compliance.
