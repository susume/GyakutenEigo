# Athletics Air-Gap Parkour + Environmental Realism Pass

Updated 2026-08-30 against the audited `main` branch (`38234b3 made the map smaller`).

## Outcome

Skyline Adventure Park remains a compact 65-landing, six-chapter classroom
race. The route now has authored transition types, exact rotated-rectangle
edge-gap measurement, shared collision footprints, and regression checks for
air separation and solid-volume overlap.

The final geometry audit reports no issues. There are 57 typed jump
transitions, all with positive measured air, and the only overlapping solid
landing pair is an intentional checkpoint entry (`checkpoint_entry`).

## Before vs. after

| Measure | Latest branch before pass | After pass |
| --- | ---: | ---: |
| Route length | ~1,371.14 | 1,345.67 |
| Main-route platforms | 65 | 65 |
| Average platform footprint (W × D) | ~20.19 × 16.28 | 14.97 × 12.77 |
| Main transitions | not typed | 64 |
| Genuine jump transitions | not instrumented | 57 |
| Positive air gaps among typed jumps | not instrumented | 57/57 (100%) |
| Jump-typed share of non-checkpoint transitions | not instrumented | 57/58 (98.3%) |
| Median jump air gap | not instrumented | 7.46 |
| Average jump air gap | not instrumented | 7.12 |
| Maximum normal-route gap | not instrumented | 11.34 |
| Maximum shortcut gap | not instrumented | 9.63 |
| Intentional connected/non-jump transitions | not instrumented | 7 |
| Moving-platform transitions | 6 moving obstacles, not typed | 6 |
| Checkpoints | 6 | 6 |
| Shortcuts | 3 | 3 |
| Default time limit | 270 seconds | 270 seconds |

Air gaps are horizontal edge-to-edge distances between the actual rotated
landing rectangles, not centre-to-centre distances. The current jump set also
fits the authored sprint-air envelope used by the tests (`14.8 × 0.861 =
12.74` world units). The largest values are intentionally late-course or
moving/attraction challenges; the normal route remains within that envelope.

## Transition and overlap rules

The shared course definition now distinguishes `easy_jump`, `jump`,
`hard_jump`, `moving_jump`, `shortcut_jump`, `attraction`, `checkpoint_entry`,
`elevator`, `connected`, and `bridge`.

`getAthleticsSurfaceAirGap` computes the closest distance between two rotated
rectangles and returns zero for touching/intersecting footprints.
`getAthleticsSurfaceVolumeOverlap` additionally checks the authored slab
heights. Geometry validation checks transition adjacency, typed minimum gaps,
moving-obstacle references, jump coverage, and accidental same-volume
intersections. The one intentional same-volume pair is the Ferris chapter’s
large checkpoint entry; it is explicitly typed `checkpoint_entry`.

Shortcut edge gaps after the final branch re-authoring are:

| Shortcut | Measured gaps, in order |
| --- | --- |
| Midway service cut | 6.55, 7.81, 7.94 |
| Ferris maintenance cut | 8.31, 6.81, 9.63, 6.17 |
| Drop tower rooftop cut | 6.48, 6.79, 6.97, 7.28 |

## Chapter breakdown

The ranges below include each chapter’s endpoint checkpoint. “Biggest gap” is
the largest non-checkpoint main-route edge gap in that chapter.

| Chapter | Route points / elevation | Jump types | Biggest gap | Moving obstacle | Attraction interaction | Checkpoint |
| --- | --- | --- | ---: | --- | --- | --- |
| Park Entrance | 0–10 / y=0–6 | `easy_jump` | 8.56 | None | Wide ticket-plaza landings and entrance silhouette | 1 at point 10 |
| Midway Mayhem | 11–21 / y=6–10 | `jump`, `moving_jump` | 9.64 | `midway-swing-platform` | Grounded food/drink stalls and bumper-car bowl | 2 at point 21 |
| Ride District | 22–32 / y=11–16 | `jump`, `moving_jump`, `elevator` | 10.76 | `ride-district-lift` | Ride decks and a maintenance lift create the vertical beat | 3 at point 32 |
| Ferris & Coaster | 33–43 / y=16–34 | `jump`, `moving_jump`, `attraction` | 9.00 | Ferris gondola crossing; coaster maintenance cart | Grounded Ferris support decks and supported coaster line | 4 at point 43 |
| Drop Tower | 44–54 / y=36–62 | `jump`, `hard_jump`, `moving_jump` | 11.34 | `drop-tower-lift` | Tower service decks, lift, and rooftop shortcut | 5 at point 54 |
| Sky Park Summit | 55–64 / y=62–110 | `jump`, `hard_jump` | 9.64 | `summit-finish-lift` | Exposed high traverse and sharp final summit ascent | 6 at point 64 |

The elevation rhythm is intentionally not a per-platform staircase: the
route repeats levels, drops between similar-height landings, uses a named
ride/elevator beat, and reserves the two large rises for the Drop Tower and
final summit lifts. Static rises above the 3.34-unit jump apex are lift-backed.

## Ferris wheel

### Previous problem

The previous imported Ferris placement was effectively at elevated route
height, so the attraction read as a floating prop instead of a park-floor
landmark.

### Final placement and integration

The existing `creative-trio-ferris-wheel.glb` is retained. Its inspected raw
local bounds are approximately 1.005 × 1.135 × 0.208 (W × H × D). The runtime
mount applies scale 52 at world position `(-72, 35.2, 28)`. The measured local
minimum Y is about `-0.6764`, so the transformed lowest point is approximately
world `y=0`; the resulting wheel height is about 59.0 world units.

The procedural fallback is now the same grounded landmark language: a
large wheel, a hub, two floor-to-hub supports, a floor base beam, and an upper
hub beam. Those supports remain visible even when the optional GLB loads, so
the wheel continues to read as structurally planted. The Ferris chapter routes
through the lower support/deck area, crosses the authored
`ferris-gondola-crossing` moving interaction, and climbs toward the supported
coaster maintenance line.

The GLB remains scenery-only. Authoritative movement uses shared rectangular
platform and moving-obstacle proxies rather than imported mesh triangles.

Blender availability was checked in the current environment and no Blender
executable was installed (`blender-not-found`), so this pass did not create a
new binary export. The existing processed GLB was bounds-inspected and its
runtime transform/support treatment was corrected. A future asset pass can
still re-open and re-export the mesh in Blender if the source pivot or wheel
silhouette needs refinement.

## Coaster and park structures

The existing Kenney coaster pieces remain optional visual assets. Track pieces
are placed around y=42–46, the train is placed on the track, and two stretched
support assets run from the park floor to the deck. The procedural fallback
also has explicit floor-reaching supports and cross-beams. The coaster cart is
called out as a moving gameplay landmark, while collision remains simple and
authoritative.

## Removed or replaced decoration

The procedural scene no longer creates:

* floating coloured sky spheres;
* thin isolated sky poles;
* the isolated water-looking bar;
* bunting made from repeated decorative spheres;
* stalls and attraction props positioned at route height without foundations;
* the former floating Ferris/coaster/drop placements.

The remaining perimeter posts are a uniform park-boundary safety system, not
random sky decoration. The bumper-car bowl, grounded stalls, Drop Tower,
Ferris supports, coaster supports, checkpoint arches, next-landing marker, and
platform edge language each have a gameplay, navigation, realism, or spectacle
role.

## Assets and licences

No new or replacement binary asset was added in this pass. The eight existing
Athletics GLBs remain covered by
[`ATHLETICS_ASSET_MANIFEST.md`](./ATHLETICS_ASSET_MANIFEST.md):

* Ferris Wheel by CreativeTrio via Poly Pizza, listed by the source as Public
  Domain / CC0;
* Kenney Coaster Kit pieces under CC0 1.0;
* the authored course, fallback structures, lighting, edge treatment, and
  collision proxies remain project-owned.

## Performance

The current optional scenery set is eight GLBs totaling 1,145,784 bytes. The
Ferris asset is loaded lazily for Athletics and all asset loads are optional;
the named procedural fallback remains playable if a request fails. No imported
mesh adds physics bodies.

The production build after this pass reported an Athletics builder chunk of
about 11.51 kB (5.17 kB gzip). The existing shared `three` chunk remains the
largest web chunk at about 569 kB (146 kB gzip); this pass did not enlarge that
dependency. The build’s existing large-chunk warning remains a performance
follow-up rather than a course correctness issue.

## Testing and review

Automated checks added or updated cover:

* rotated rectangle edge-gap calculation, touching, separation, and volume
  overlap;
* main-route jump thresholds, 75% coverage, typed exceptions, shortcut
  separation, moving-platform references, route adjacency, sizes, bounds,
  checkpoints, start lanes, respawn, finish, route progress, and energy;
* oriented client/server collision parity;
* Ferris/coaster transforms and optional fallback hiding;
* Athletics onboarding, touch jump, and tablet Sprint + Jump controls.

Results:

* shared tests: 125/125 passed after the final geometry changes;
* focused web camera/asset/HUD tests: 19/19 passed;
* iPad-like Athletics E2E: 2/2 passed, including Sprint + Jump together;
* TypeScript typecheck: passed;
* production build: passed;
* lint: passed;
* the broader web suite: 216/217 passed in the observed full-suite run. The
  single failure was the existing `CharacterFactory.performance.test.ts`
  construction-time threshold under full-suite load; its isolated rerun
  passed at approximately 385 ms. The Athletics tests in that suite passed;
* the broader 15-test E2E run: 14/15 passed. The one failure was the existing
  classroom speed assertion (`classroom.spec.ts`) under local timing load;
  the Athletics desktop flow passed.

For first-person review, the hosted Athletics start screen was checked with
the onboarding prompt, visible first gap, next-landing marker, energy loop,
checkpoint HUD, Ferris/coaster skyline, and no old sky filler. The Character
Lab was also staged at approximately 8%, 23%, 39%, 56%, 74%, and 91% course
progress to inspect each chapter from the FPS camera. The browser automation
environment did not complete a literal human-controlled traversal of all 65
landings; a real tablet playthrough remains the final experiential check,
especially for diagonal movement, moving-platform timing, and repeated
late-course jumps.

## Remaining concerns

The design is materially air-gap-driven now, but a few later main-route gaps
are intentionally near the sprint envelope (maximum 11.34 versus 12.74
available in the current movement model). They should be rechecked by a human
on a tablet rather than tuned only from keyboard geometry. The imported Ferris
mesh itself was not re-exported because Blender was unavailable, so a future
Blender pass could still improve its pivot/material cleanup. The current
runtime support treatment and bounds-grounding are in place.

## Student-perspective answers

1. **Do most jumps visibly cross empty air?** Yes. 57 of 58 non-checkpoint
   transitions are explicitly jump-typed, and all 57 have positive exact
   edge-to-edge air gaps.
2. **Does the course still feel like climbing stairs anywhere?** No as an
   authored pattern: repeated-height traverses, drops, and named lifts replace
   the old continuous staircase. A full human run should still verify that the
   late Drop Tower/Summit sequence reads as intended.
3. **Does the elevation progression feel varied rather than continuously
   rising?** Yes. It uses lateral plateaus, small drops, attraction sections,
   lift-backed climbs, and a final sharp ascent.
4. **Does the Ferris wheel look physically grounded and realistically scaled?**
   Yes in the corrected runtime composition: its measured lowest point is at
   the floor, it has explicit supports, and its approximately 59-unit height
   makes it a skyline landmark. A Blender re-export was not possible in this
   environment.
5. **Does every major environmental object have a clear purpose?** Yes. The
   remaining major objects are route surfaces, moving interactions, navigation
   markers, grounded attractions/supports, classroom context, or skyline
   spectacle.
6. **Does the amusement park feel intentionally designed rather than randomly
   decorated?** Yes. Scenery is sparse and grouped into entrance, midway,
   attraction, Ferris/coaster, tower, and summit compositions; the old filler
   primitives were removed.
7. **Would a student want to replay the course after finishing?** Likely yes:
   the route has three optional shortcuts, moving timing, question-powered
   energy, six visual chapters, and a short race loop. A live tablet traversal
   is still the best final confirmation of replay comfort.
