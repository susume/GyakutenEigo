# QS AR-1 Arena Rifle — Audit and Results

## 1. Old system

The previous starter, quick, and heavy launcher visuals were assembled in `CharacterEquipment.ts` from a small box, one or two cylinders, a narrow barrel tube, rings, and a grip. They were procedural rather than loaded assets. The starter had no readable stock or handguard mass, so its length was carried almost entirely by the barrel cylinder and it read as a rod.

The visual root was parented to `RightHandWeaponSocket`; the dominant hand therefore owned the weapon. `LeftHandSupport` existed as a child object but was only displayed by the socket debug mode. No animation code consumed it, so the support hand was positioned by fixed arm angles and merely landed near the old barrel.

Weapon switching rebuilt the character from the existing gear ID. The lobby always requested `starter_blaster`. First person used a separate view model, but the flash, pressure ring, and displayed snowball started from hard-coded camera coordinates. Gameplay fire direction, damage, range, cooldown, ammo, networking, and validation did not depend on the visual mesh.

## 2. New weapon

`CharacterEquipment.ts` now builds a shared QS AR-1 platform with:

- rounded compact stock and cheek pad;
- large neutral receiver shell;
- glove-sized rear grip;
- translucent fictional snow cell with a low-cost snowflake detail;
- broad handguard and support-hand contact pad;
- substantial barrel housing;
- cold emitter and pressure rings;
- compact holographic sight;
- controlled team trim.

Starter, Quick, and Heavy retain their existing gear IDs and gameplay profiles. They use the same design language with bounded length, barrel, chamber, and optic variations, so switching no longer returns to a primitive rod.

## 3. Attachments

All weapon calibration is centralized in `WEAPON_MOUNT_TRANSFORMS`. Each weapon exposes:

- `RearHandGrip`;
- `SupportGrip`;
- `ShoulderContact`;
- `MuzzleSocket`;
- `SightSocket`.

The dominant hand remains the owning parent. The animator resolves the authored rifle orientation relative to the torso, then offsets the weapon so `RearHandGrip` stays exactly in the dominant palm. The support arm solves to `SupportGrip`. The stock contact is calibrated to the dominant shoulder, and all visible snow effects can resolve from `MuzzleSocket`.

Measured idle socket distances on the scaled character were:

- dominant hand to rear grip: `0.000`;
- support hand to support grip: approximately `0.145`;
- shoulder joint to stock contact: approximately `0.204`.

## 4. Animation

The former fixed approximate support pose is replaced by a lightweight analytical two-bone support-arm solve. The elbow uses an outside/down pole vector to avoid folding into the torso. The rifle is now torso-oriented instead of inheriting the full forearm rotation, which removes the vertical-rod presentation.

Idle is a horizontal relaxed-ready hold. Aim raises/lowers with the existing pitch input. Sprint lowers the rifle while both hands remain attached. Crouch keeps the snow cell clear of the thighs. Fire recoil braces the torso and arms without separating the rear grip. A weapon-aware victory stance replaces the former flourish that pulled the rifle through the chest.

Objective carrying still preserves its existing one-hand/flag behavior.

## 5. First person

First person remains a dedicated camera view model. Its weapon transform is centralized per gear. The crosshair stays clear and the stock/head never enter the camera.

The snow puff, cold pressure ring, and displayed snowball now synchronize to the first-person `MuzzleSocket` instead of fixed camera coordinates. Remote third-person fire events carry the firing player ID, resolve that character's live muzzle socket, and emit a smaller cold snow pulse at that world position.

## 6. Team system

Red and Blue use identical cached geometry. The receiver, stock, grip, handguard, and barrel use shared neutral off-white and charcoal materials. Only the accent material changes between blue/cyan and red/coral.

Snow fire remains `#b9f4ff` for both teams; Red does not fire red snow.

## 7. Gameplay

No weapon statistics or authoritative gameplay logic changed. Damage, range, fire cadence, ammo, cooldowns, accuracy, hit validation, projectile direction, weapon switching, game rules, and network payloads remain driven by the existing gear IDs and server configuration.

The visual muzzle is used for presentation only. Authoritative aiming is not derived from decorative geometry.

## 8. Testing

Automated:

- full web suite: `106/106` passing;
- TypeScript typecheck passing;
- production Vite build passing;
- rear/support/shoulder/muzzle socket assertions;
- Human, Fox, Panda, Bear, Rabbit, and Robot clearance;
- Red/Blue shared geometry and accent-material variation;
- starter/quick/heavy silhouette bounds;
- first-person muzzle placement for all three weapons;
- LOD detail removal before silhouette removal;
- walk, sprint, crouch, aim, fire, jump, respawn, victory, hit, and objective-carry animation coverage;
- 40-character shared-geometry construction test.

Live browser review:

- Blue and Red lobby variants;
- Human, Panda, and Rabbit heads;
- front, rear, left/right, and front/rear three-quarter rotations;
- idle, aim, sprint, crouch, jump, shoot, respawn, and victory previews;
- dedicated first-person view and crosshair clearance;
- generated 40-player Character Lab;
- team switching in a real in-memory waiting session;
- no browser console errors.

Character reconstruction on gear/team changes remains the existing multiplayer path used by remote players, late joins, and respawns. No mesh state is added to the network protocol.

## 9. Performance

Geometry is generated once per gear and cached. All players of a gear share the same silhouette and detail buffer geometry.

Starter QS AR-1:

- silhouette: `6,864` triangles;
- removable close detail: `240` triangles;
- full LOD0 total: `7,104` triangles;
- LOD0: 2 merged meshes / 8 material groups;
- LOD2: detail mesh hidden / 4 material groups;
- LOD3: complete weapon hidden.

The 40-character test reported one shared starter-rifle geometry and completed construction in about `500 ms` on the test machine. Live Character Lab review remained in the existing performance envelope; tiny bevels are not duplicated per player.

## 10. Visual review

The weapon now reads as a purpose-built sporting snow rifle rather than a tube. The receiver, sight, snow cell, emitter, and two-hand contact remain readable at the lobby camera distance. The front three-quarter default angle exposes the character face and weapon together.

No heavy head, backpack, chest, thigh, or floor intersections were observed in the reviewed poses. The compact stock is intentionally partly occluded by the dominant arm from a direct front view, but reads from side and rear-three-quarter views. The respawn preview can briefly move the full character below the fixed lobby framing during its existing rise animation; this is a preview-framing artifact, not weapon clipping.
