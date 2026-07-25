# Spectator Mode — Bounded UX Audit and Redesign

## Audit scope

Flag Mode, desktop in-round spectator state after the local player is frozen.

## Player goal

Keep following the round, understand who the camera is watching, switch viewpoints quickly, and know when active play resumes.

## Current-state health

1. **Frozen state appears — needs change.** The message is understandable, but a large light panel covers the center of the arena and reads like a blocking modal even though spectating is the primary activity.
2. **Watched player is identified — partially healthy.** The name is visible, but it competes with explanatory copy and is not connected to useful live information.
3. **Player switching — partially healthy.** Previous and next controls work, but their location inside the center panel makes the obstruction persistent.
4. **Return expectation — healthy copy, weak placement.** The player is reassured that they will return next round, but the full sentence is too large for information that should remain glanceable.

## Accessibility risks visible from the screenshot

- The center panel interrupts visual tracking of the arena and may increase cognitive load during a time-sensitive round.
- The watched-player label and switching controls do not form a clearly named spectator control group.
- Screenshot evidence cannot confirm keyboard focus, focus order, screen-reader announcements, or target sizing.

## Implemented direction

- Replace the eliminated player’s bottom status HUD with a dedicated spectator dock.
- Keep the center of the playfield entirely clear.
- Lead with watched-player identity and position in the available-player list.
- Preserve large previous/next controls with explicit accessible labels.
- Show useful live context for the watched player: warmth, snowballs, gear, and team.
- Keep “Frozen this round” and “Back next round” as short, persistent reassurance.
- Collapse secondary stats before core switching controls at narrower widths.
