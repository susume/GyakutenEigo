# Speaking Practice implementation review — 2026-09-06

## Conclusion

The implementation needed further corrections to match the original audit's priorities. Local mock tests support a controlled development pilot, not a claim that forty real students can reliably speak at once. The original audit remains the acceptance baseline; attached implementation instructions are historical context, not evidence that their requirements were met.

## Corrections from this review

- **A02 — speaking controls:** moved microphone, Replay and Help immediately below the current partner message, before the transcript. The transcript scrolls internally. Viewport checks do not first scroll the microphone into view.
- **A02/A06 — notices blocked Finish:** a browser failure reproduced a mobile notice covering Finish. An older, higher-specificity absolute-position rule overrode the intended flow layout. Notices now occupy normal document space with transforms reset.
- **A01/A14 — join retries:** the browser persists a random, tab-scoped recovery secret before joining. A retry can recover only the participant matching both its secret and request identity. Wrong-secret retries do not disclose credentials. Malformed pending records are replaced. Student numbers may be one character.
- **A01 — admission races:** participant creation enforces capacity and duplicate request identity inside the repository. PostgreSQL admission serializes on the session row before counting; its live database behavior still needs integration validation.
- **A04 — upload admission lifetime:** full token verification precedes raw audio parsing. The upload slot remains held until route work actually finishes, even when the browser disconnects while a provider retains the body. Parser failures release the slot.
- **A11 — late Help responses:** an in-flight ref prevents duplicate Help requests; unmount aborts the request; late results cannot open Help after recording starts, authorization fails, or the activity becomes terminal.
- **Transcript ordering:** fresh screenshot inspection exposed same-millisecond answers/replies being reordered by random UUIDs. Client merges preserve insertion order on ties; new server turns use increasing timestamps so database reloads retain causal order.
- **A12/A15 — regression evidence:** added tests for stale evaluation workers, concurrent capacity, secure join recovery and expression editing retaining focus. These complement earlier review corrections already present in the repository, including evaluation attempt guards, microphone preflight truthfulness and playback state handling.
- **Reporting:** the load helper's early-exit memory field now explicitly describes the load client, not the server. Server memory and database load are marked unmeasured.

## Verification

- Full `npm run test` passed during this review. Subsequent targeted tests cover the additional capacity and timestamp-ordering changes.
- Server and web production builds passed. The web build reports its existing large-chunk warning.
- Server and web typechecks passed, including the E2E TypeScript project.
- Final rebuilt Speaking browser suite: **3/3 passed (23.8 seconds)**, after the transcript-ordering correction. Final targeted repository/classroom/lifecycle run: **11/11 passed**; route/lifecycle run: **6/6 passed**.
- Browser checks include 1366×768, 1024×768, 768×1024 and 390×844, plus 125% CSS zoom. This is not a substitute for physical mobile browser or OS/browser zoom testing.
- The failed notice-overlay test was fixed in application CSS, not bypassed with a forced click. Synthetic recordings now last 300 ms so the real activity monitor has time to sample them; a zero-duration test click is not evidence of spoken audio.

## Remaining release gates and gaps

1. Run the original seven-minute, forty-device voice workload with real transcription, conversation and evaluation providers on the school network. Measure latency, accepted-turn integrity, overload/retry outcomes and evaluation completion.
2. Validate PostgreSQL transactions, expired evaluation recovery and two-instance behavior against a disposable database. Turn/Help locks and provider admission remain process-local; do not claim multi-instance serialization or a global quota budget.
3. Measure **server** RSS/heap and database load during binary uploads, including disconnects and overload. The local forty-join test does not establish forty simultaneous voice-turn capacity.
4. Exercise physical microphones, Safari/iOS playback and permission transitions, and classroom noise. Browser TTS availability and browser audio metering are device-dependent.
5. The existing polling unit file tests delay calculation, revision comparison, merge ordering and frozen timers. It does **not** prove full scheduler overlap/cancellation behavior; earlier broader coverage claims should not be repeated.
6. A deliberate teacher retention/deletion policy and broader saved-session discovery remain product work. Secret-based recovery is specifically for retrying a lost join response, not recovering a cleared browser profile.

No production deployment, paid provider calls, database migration or account reset was performed for this review.
