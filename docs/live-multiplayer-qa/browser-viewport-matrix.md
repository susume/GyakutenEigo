# Browser and viewport matrix

| Session | Browser context | Identity | Viewport / capture | Outcome |
|---|---|---|---|---|
| A | Codex in-app browser | QA Teacher | 1280×720 CSS px, DPR 1.75 | Host flow, quiz creation, three rooms, bot management, starts/results. |
| B | Chrome regular profile | BlueQA / ZombieQA / ClassicQA / ErrorQA | Default live area about 1098×531 CSS px, DPR 1.75 | Joined and completed Flag, Zombie, Classic; quiz and invalid-code checks. |
| B | Chrome viewport override | ClassicQA | 1280×720 | Results view rendered without horizontal clipping; ended timer defect visible. |
| B | Chrome viewport override | ClassicQA | 1366×768 | Results view rendered without horizontal clipping; ended timer defect visible. |
| C | Chrome Incognito | Intended `RedQA` | Not captured | Context opened, but two consecutive Windows capture/control timeouts blocked use. |

Not run: 1920×1080, 1440×900, 1024×768, browser zoom levels, fullscreen, or a real Chromebook device.
