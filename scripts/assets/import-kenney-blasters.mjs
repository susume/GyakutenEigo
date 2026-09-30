import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, weld } from '@gltf-transform/functions';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const source = process.argv[2];
if (!source) throw new Error('Pass the extracted official Kenney Blaster Kit directory');
const output = resolve('apps/web/public/assets/community/kenney-blasters');
await mkdir(output, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const assets = [];
for (const name of ['blaster-a', 'blaster-h', 'blaster-n']) {
  const input = resolve(source, 'Models/GLB format', `${name}.glb`);
  const document = await io.read(input);
  await document.transform(dedup(), flatten(), join(), weld(), prune());
  const destination = resolve(output, `${name}.glb`);
  await io.write(destination, document);
  const bytes = await readFile(destination);
  assets.push({ file: `${name}.glb`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await copyFile(resolve(source, 'License.txt'), resolve(output, 'LICENSE.txt'));
await writeFile(resolve(output, 'provenance.json'), JSON.stringify({ source: 'https://kenney.nl/assets/blaster-kit', version: '2.1', license: 'CC0-1.0', modifications: 'Embedded palette texture, flattened and merged static geometry; normalized by gameplay sockets at runtime.', assets }, null, 2));
console.log(assets);
