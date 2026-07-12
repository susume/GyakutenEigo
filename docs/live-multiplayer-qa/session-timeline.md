# Live multiplayer QA session timeline

All times are Asia/Tokyo on 2026-07-12. Times are approximate to the nearest minute.

| Time | Host / session | Player browser | Observation |
|---|---|---|---|
| 17:10 | Local web and game services started | — | Web `localhost:5173`; server `localhost:4000`; no startup errors. |
| 17:11 | QA Teacher created quiz and Flag room `SWWJCT` | — | Four generated questions; 60-second, one-round session. |
| 17:13 | Flag lobby | BlueQA joined in independent Chrome profile | Host roster updated; BlueQA assigned Blue; Atlas Bot 1 assigned Red. |
| 17:15 | Flag round started | BlueQA active | Host/player visible timers both showed 0:44 in paired screenshots. |
| 17:16 | Flag timeout | BlueQA had quiz open | Match ended 0–0; quiz dialog remained over results; late answer produced wrong-state error. |
| 17:18 | Zombie room `6W92NE` | ZombieQA joined | Prior quiz dialog reappeared in the new lobby. Lobby also used “Blue Team Ready Room.” |
| 17:18 | Zombie round started | ZombieQA Human; Atlas Bot 1 Zombie | Both sessions agreed on 1 Human / 1 Zombie; paired screenshots showed 0:43. |
| 17:19 | Zombie timeout | ZombieQA still Human | Result said teams tied; no Human-survival winner was identified. |
| 17:20 | Classic room `E82XP8` | ClassicQA joined | Player + opposing bot; round started. |
| 17:21 | Classic active | ClassicQA answered denominator question correctly | Player HUD updated from $0 to $400; final accuracy 100%. |
| 17:22 | Classic result | ClassicQA | Result reached; ended HUD reset timer to 1:00. 1280×720 and 1366×768 captures taken. |
| 17:22 | Error handling | ErrorQA used `BAD999` | Clear “Session not found” message with next action. |

## Independent session attempt

- Session A: Codex in-app browser, persistent isolated store, host identity `QA Teacher`.
- Session B: Chrome profile `ユーザー 1`, player identities `BlueQA`, `ZombieQA`, and `ClassicQA` across sequential rooms.
- Session C: Chrome Incognito opened as a separate browser context. Windows capture/control timed out twice while loading the join page, so no player was joined and no claims are based on this session.
