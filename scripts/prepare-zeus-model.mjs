// Convert SMK's public-domain KAS1110 scan into a compact, smooth game asset.
// Usage: node scripts/prepare-zeus-model.mjs path/to/KAS1110_small.stl
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const input = process.argv[2];
if (!input) throw new Error('Pass the downloaded KAS1110_small.stl path.');
const bytes = await readFile(input);
const geometry = new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const originalTriangles = geometry.getAttribute('position').count / 3;
geometry.rotateX(-Math.PI / 2); // STL Z-up to glTF Y-up.
geometry.computeBoundingBox();
const bounds = geometry.boundingBox;
const center = bounds.getCenter(new THREE.Vector3());
geometry.translate(-center.x, -center.y, -center.z);
geometry.scale(...Array(3).fill(4.5 / (bounds.max.y - bounds.min.y)));
geometry.deleteAttribute('normal');

// Remove the display stem beneath the neck. Clip crossing triangles at a
// plane so the lower silhouette stays clean; the cloud covers the open base.
const positions = geometry.getAttribute('position');
const croppedPositions = [];
const cutY = -0.85;
for (let start = 0; start < positions.count; start += 3) {
  const triangle = Array.from({ length: 3 }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, start + i));
  const polygon = [];
  for (let i = 0; i < 3; i++) {
    const a = triangle[i];
    const b = triangle[(i + 1) % 3];
    if (a.y >= cutY) polygon.push(a);
    if ((a.y >= cutY) !== (b.y >= cutY)) polygon.push(a.clone().lerp(b, (cutY - a.y) / (b.y - a.y)));
  }
  for (let i = 1; i < polygon.length - 1; i++) croppedPositions.push(...polygon[0].toArray(), ...polygon[i].toArray(), ...polygon[i + 1].toArray());
}
geometry.setAttribute('position', new THREE.Float32BufferAttribute(croppedPositions, 3));
geometry.computeBoundingBox();
const croppedBounds = geometry.boundingBox;
const croppedCenter = croppedBounds.getCenter(new THREE.Vector3());
geometry.translate(-croppedCenter.x, -croppedCenter.y, -croppedCenter.z);
geometry.scale(...Array(3).fill(4.5 / (croppedBounds.max.y - croppedBounds.min.y)));
const croppedTriangles = geometry.getAttribute('position').count / 3;

const doc = new Document();
const buffer = doc.createBuffer();
const material = doc.createMaterial('Zeus ivory sculpture').setBaseColorFactor([0.8, 0.74, 0.63, 1]).setRoughnessFactor(0.76).setMetallicFactor(0);
const primitive = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(geometry.getAttribute('position').array).setBuffer(buffer)).setMaterial(material);
doc.createScene('Zeus Ammon · SMK KAS1110').addChild(doc.createNode('Zeus Ammon scan').setMesh(doc.createMesh('Zeus Ammon').addPrimitive(primitive)));
doc.getRoot().getAsset().copyright = 'Zeus Ammon (KAS1110), SMK / Scan the World. Public domain. Simplified and normalized for QuizStrike.';
await MeshoptSimplifier.ready;
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 40000 / croppedTriangles, error: 0.003 }), prune());

// Smooth the scanned surface after decimation; avoid faceted STL face normals.
const smoothed = new THREE.BufferGeometry();
smoothed.setAttribute('position', new THREE.BufferAttribute(primitive.getAttribute('POSITION').getArray(), 3));
smoothed.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray(), 1));
const indexed = mergeVertices(smoothed, 0.00001);
indexed.computeVertexNormals();
primitive.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(indexed.getAttribute('position').array).setBuffer(buffer));
primitive.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(indexed.getAttribute('normal').array).setBuffer(buffer));
primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(indexed.index.array).setBuffer(buffer));
await doc.transform(prune(), quantize());
const output = 'apps/web/public/assets/zeus/zeus-ammon.glb';
await mkdir('apps/web/public/assets/zeus', { recursive: true });
await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(output, doc);
const result = await readFile(output);
await writeFile('apps/web/public/assets/zeus/provenance.json', JSON.stringify({
  title: 'Zeus Ammon', inventoryNumber: 'KAS1110',
  source: 'https://open.smk.dk/en/artwork/image/KAS1110',
  download: 'https://api.smk.dk/api/v1/download-3d/hd76s484q_KAS1110_small.stl',
  creator: 'Unknown ancient sculptor; scan supplied by SMK / Scan the World',
  license: 'Public domain', licenseUrl: 'https://www.smk.dk/en/section/use-of-smk-material/',
  modifications: ['STL converted to GLB', 'Z-up converted to Y-up', 'Museum display stem cropped below the neck', 'Centered and normalized to 4.5 units tall', 'Simplified and smooth normals generated', 'Ivory material and quantized geometry'],
  sourceSha256: createHash('sha256').update(bytes).digest('hex'),
  sha256: createHash('sha256').update(result).digest('hex'),
  originalTriangles, triangles: primitive.getIndices().getCount() / 3, bytes: result.length
}, null, 2) + '\n');
console.log(JSON.stringify({output, triangles: primitive.getIndices().getCount() / 3, bytes: result.length}));
