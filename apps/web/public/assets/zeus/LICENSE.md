# Zeus Ammon (KAS1110)

The character uses the public-domain 3D scan of **Zeus Ammon** supplied by
**SMK — National Gallery of Denmark / Scan the World**. The museum's artwork
page identifies the material as free to use and the artwork as public domain.
Source and licensing were checked on 14 October 2026.

- Artwork: https://open.smk.dk/en/artwork/image/KAS1110
- Museum 3D collection: https://www.smk.dk/en/article/3d-models/
- Museum use policy: https://www.smk.dk/en/section/use-of-smk-material/
- Source STL: https://api.smk.dk/api/v1/download-3d/hd76s484q_KAS1110_small.stl

QuizStrike crops the museum display stem below the neck, corrects the up axis,
centers the head, simplifies the scan from 399,996 to 40,000 triangles, generates
smooth normals, and adds an ivory stone material. The locally bundled GLB is
562,008 bytes and requires no external textures or museum connection at runtime.
This is a realistic scan of a classical sculpture, with natural facial anatomy;
it does not depict a living actor or use a skin texture.

`provenance.json` records the source and resulting asset hashes. Reproduce it
from the original STL with:

```powershell
node scripts/prepare-zeus-model.mjs 'path/to/KAS1110_small.stl'
```
