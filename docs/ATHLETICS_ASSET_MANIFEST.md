# Athletics Adventure Park asset manifest

Updated 2026-08-29.

## Course geometry

The Skyline Adventure Park course is generated at runtime by
`apps/web/src/game/athleticsStadiumBuilder.ts` from the shared authored course
definition in `packages/shared/src/athleticsRace.ts`. Platforms, supports,
stairs, arches, stalls, the Ferris wheel, coaster structure, drop tower, and
moving obstacles are procedural Three.js geometry. No external 3D model,
texture, HDRI, sound, or downloaded park asset was added for this redesign.

The renderer and authoritative collision model therefore share the same
project-owned source data, with no separate asset license or redistribution
obligation for the Athletics course.

## External asset research

These open libraries were checked as possible sources during the art pass, but
none of their files were imported into Athletics:

| Library | License reference | Used in Athletics |
| --- | --- | --- |
| [Poly Haven](https://polyhaven.com/license) | CC0 1.0 / public domain dedication | No |
| [Kenney](https://kenney.nl/support) | Public-domain / CC0 asset policy | No |

If a future art pass imports an asset, add its name, creator, source URL,
license URL, license verification date, original file, processed output,
processing steps, dimensions, triangle count, file size, and intended use to
this manifest before shipping it.
