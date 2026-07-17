# Arena performance certification

## Current implementation status

The arena now exposes a bounded performance snapshot on the WebGL canvas and in Character Lab. It captures FPS, p50/p95/p99 frame time, worst frame, draw calls, triangles, textures, geometries, JavaScript heap when available, and browser long tasks. Character Lab can switch between both maps, all three quality levels, and 10/20/40/60-player scenarios.

Static modular facades use one 2K surface atlas and six or fewer material batches per map. Gameplay collision remains on invisible box proxies, so visual mesh changes do not change movement or cover behavior. World-space VFX are pooled and capped at 6/12/16 active effects for Low/Medium/High.

## Local automated baseline — 2026-07-17

Environment: Windows Codex in-app browser, 864 × 488 arena viewport, 40 generated players, simulated network movement, Medium quality. This is a development baseline, not physical-device certification.

| Scene | Duration | FPS at end | p95 frame | Draw calls | Triangles | Long tasks | JS heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Desert Citadel | short capture | 45 | 29.4 ms | 356 | 66,528 | 4 | 36.1 MB |
| Iron Junction | ~60 s soak | 55 | 22.8 ms | 338 | 63,236 | 11 cumulative | 52.1 MB |

The Medium draw-call acceptance threshold is `< 400`, leaving margin below the previous 486-call baseline. Long-task counts include initial compilation and asset construction; physical runs should record both cold-start and steady-state counts separately.

## Physical certification matrix

Run each row for both maps on Medium, with 40 players and simulated movement. Repeat Low only if Medium misses a blocking threshold.

| Target | Required capture | Status |
| --- | --- | --- |
| Physical Chromebook | ChromeOS model/CPU/RAM, 10-minute soak, cold start, frame-time trace, GPU memory | Pending device access |
| Integrated-GPU Windows desktop | GPU/driver, Edge stable, 10-minute soak, cold start, frame-time trace, GPU memory | Pending device access |
| Microsoft Edge | Exact Edge version, 10-minute soak, long-task export, console errors | Pending explicit Edge run |
| 40-player soak | FPS/p95/p99/worst, calls/tris, heap, long tasks at 1/5/10 minutes | Local 60-second baseline complete; 10-minute physical run pending |

## Acceptance gates

- No WebGL context loss, uncaught error, missing character skin, or invisible collision mismatch.
- Medium remains below 400 draw calls in the 40-player scene.
- Steady-state p95 frame time is at or below 33.3 ms on the certification Chromebook; preferred target is 20 ms or lower on the integrated-GPU desktop.
- GPU memory remains below 256 MB and does not grow by more than 10% between minutes 5 and 10.
- JavaScript heap and renderer texture/geometry counts plateau; no monotonic growth across the soak.
- No steady-state long task over 100 ms. Any task over 50 ms must be attributable to a user action, map load, or results transition.
- Pooled VFX never exceed the quality cap and never cover more than roughly 18% of the viewport with additive effects.

## Run procedure

1. Open `/character-lab`, select 40 players, Medium, and the target map.
2. Leave simulated network movement enabled. Reload once for the cold-start capture.
3. Record the Character Lab overlay at 1, 5, and 10 minutes. The same values are available as `data-*` attributes on the arena canvas.
4. In browser performance tools, record the first 30 seconds and minutes 9–10. Save the trace with the device, browser, map, quality, and date in its filename.
5. In browser graphics diagnostics, record GPU name, driver, hardware acceleration state, and memory. Reject software rendering.
6. Repeat on the other map. Log any visual/collision discrepancy with the map, location, and camera view.

## Notes for results review

The local baseline is useful for regressions in draw calls, triangles, heap, and long tasks. FPS from a desktop automation surface is not a substitute for a physical Chromebook measurement because browser visibility, virtualization, thermal state, and GPU selection can materially change frame pacing.
