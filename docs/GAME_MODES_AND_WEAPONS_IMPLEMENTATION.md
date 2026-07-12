# Game Modes and Weapons Implementation

## Files Changed

- `packages/shared/src/index.ts`
- `packages/shared/src/sessionRules.test.ts`
- `packages/shared/dist/*`
- `apps/server/src/index.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/api/client.ts`
- `apps/web/src/game/ArenaPreview.tsx`
- `apps/web/src/game/GameAudio.ts`
- `apps/web/src/game/GameAudio.test.ts`
- `apps/web/src/styles.css`
- `README.md`

## Damage-Registration Root Cause

The working Starter Snowball Launcher, Quick Snowball Launcher, and previous Power launcher all entered the same server `fire_action` path, but projectile validation still depended on global projectile constants. The server was not asking the shared gear configuration for range or scoped hit radius, so non-starter gear did not have a complete authoritative combat profile. This made visual firing and server-side hit acceptance drift apart, especially for faster or longer-range gear.

The fix keeps one shared pipeline:

1. Client sends fire intent and current position.
2. Server validates token, round state, duplicate request id, cooldown, and snowball count.
3. Server resolves target with `getGearRange()` and `getGearHitRadius()`.
4. Server applies `resolveTagAction()` or Zombie conversion.
5. Server broadcasts the resulting session state and hit feedback.

## Heavy Snowball Launcher

The old `power_blaster` is now the Heavy Snowball Launcher.

- Damage: `HEAVY_GUN_DAMAGE = 100`
- Purchase price: `$6000` (the default Starter launcher is not sold in the Buy Menu)
- Cooldown: `HEAVY_GUN_COOLDOWN_MS = 1500`
- Range: `HEAVY_GUN_RANGE = 120`
- Scope: right-click cycle: normal (`72°`) → medium (`46°`) → deep (`30°`) → normal
- Accuracy: unscoped (`0.52`) < medium scope (`0.82`) < deep scope (`0.98`) hit radius
- Audio: procedural `heavy_fire` report plus delayed echo, with no external asset dependency

The Heavy launcher can fire at either zoom level. Its zoom exits on a weapon switch, knockout, round/match end, game menu pause, pointer-lock exit, or arena cleanup. The server receives the zoom level with fire intent so the configured accuracy tier is resolved by the same authoritative projectile path.

## Launcher shop balance

- Starter Snowball Launcher: default equipment, range `36`, not purchasable as a downgrade.
- Quick Snowball Launcher: `$3000`, range `48`.
- Heavy Snowball Launcher: `$6000`, range `120`.

The server rejects attempts to replace a purchased launcher with the default Starter launcher, even if an old client or crafted request still sends that gear id.

## Flag Mode

Flag Mode is the default game mode.

Defaults:

- Rounds: 10
- Round duration: 180 seconds
- Flag hold time: 30 seconds
- Team assignment: Players Choose

Red Team attacks. Blue Team defends. Red wins a round by knocking out Blue or placing the flag in Blue base and protecting it until the hold timer expires. Blue wins by knocking out Red before placement, capturing a placed flag, or timeout before Red places the flag.

Implemented flag states:

- `available`
- `carried`
- `dropped`
- `placed`
- `captured`

The server owns flag state, carrier, placement, capture, countdown, round result, and match result. The current implementation uses a single `E` interaction intent for pickup, placement, and capture rather than a multi-second progress bar.

## Round State

The server uses existing session status plus round metadata:

- Waiting room
- Active round
- Round result event
- Automatic next round
- Match ended

Round wins are stored in `session.roundWins`. When configured rounds are complete, the session ends and reports the match winner or draw.

## Host Settings

The teacher setup UI now exposes:

- Game Mode: Flag Mode, Zombie Mode, Classic Tag Practice
- Rounds
- Round duration
- Flag Hold Time
- Team Assignment
- Starting Zombies

Mode-specific fields are hidden when they do not apply.

## Zombie Mode

Zombie Mode selects initial zombies authoritatively with `selectInitialZombies()`.

Rules implemented:

- At least one zombie is selected when enough players exist.
- At least one human remains when possible.
- Zombies are placed on Red Team and use the Starter Snowball Launcher as the Snowball Launcher.
- Humans are placed on Blue Team.
- A valid zombie snowball tag converts a human immediately.
- Converted players keep accumulated stats, gain one respawn, and re-enter as zombies.
- The match ends once no active humans remain.

## Scoreboard Statistics

Scoreboard rows are built from `buildScoreboardRows()`.

- Tags: `player.tags`; fallback is existing score for older state.
- Respawns: returns after initial spawn, including practice respawn, bot respawn, and zombie conversion.
- Question Accuracy: `correct / attempted (percent)`, or `-` when attempted is zero.
- Supports bots, local-player marking, team/role grouping, and disconnected-state fields.

The Tab scoreboard is hold-to-show during gameplay and does not intercept forms, menus, or other typing targets.

## Networking Messages

Added or changed:

- `fire_action.scoped`
- `flag_action`
- `POST /api/sessions/:code/players/:playerId/team`

Clients still send intentions. The server validates team selection, weapon fire, flag interaction, zombie conversion, tags, respawns, round wins, and match endings.

## Bot Behavior

Bots continue to use the authoritative damage path. In Flag Mode, eliminated bots stay out until the next round. In Zombie Mode, zombie bots target human-role opponents through team assignment and conversion state. Full objective navigation is intentionally basic.

## Tests Added

Shared tests cover:

- Heavy launcher damage, cooldown, range, and scope config
- Shared projectile targeting for Starter, Quick, and Heavy launchers
- Flag Mode defaults and settings sanitation
- Balanced team randomization
- Flag pickup, placement, countdown, drop, and capture state
- Initial zombie selection and conversion
- Scoreboard row stats and no-question accuracy display

## Known Limitations

- Flag placement and capture are currently single authoritative interactions, not timed progress bars.
- Bot objective play is simple and does not include advanced path planning to carry or capture the flag.
- Multiplayer was type-checked and build-checked locally, but a two-browser manual multiplayer pass was not completed in this run.
- The Heavy launcher uses procedural audio rather than a recorded asset.

## Future Extension Points

The shared model uses `teamId`, `roundWins`, `role`, and scoreboard rows rather than hard-wiring all future reporting to fixed Red/Blue labels. This leaves room for class-versus-class names, school-versus-school matches, spectators, match histories, side switching, and tournament reporting.
