import * as THREE from "three";

type Surface = "floor" | "stone" | "wood" | "water" | "sand" | "metal";

/** Neutral tiles: map paint supplies the hue, the tile supplies the material. */
export const makeCombatSurfaceTexture = (kind: Surface, resolution = 512) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = resolution;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(resolution / 512, resolution / 512);
  ctx.fillStyle = kind === "water" ? "#b5e8e2" : kind === "wood" ? "#eadac1" : "#e9ebe5";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 319;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  ctx.fillStyle = kind === "floor" ? "rgba(36,48,47,.12)" : "rgba(51,55,46,.045)";
  for (let i = 0; i < (kind === "floor" ? 1600 : 650); i++) {
    const size = kind === "floor" ? 1 + random() * 3 : 1.5;
    ctx.fillRect(random() * 512, random() * 512, size, size);
  }
  if (kind === "stone") {
    for (let row = 0; row < 4; row++) for (let col = -1; col < 4; col++) {
      const x = col * 170 + (row % 2) * 85;
      ctx.fillStyle = `rgba(68,74,62,${.025 + random() * .045})`;
      ctx.fillRect(x + 2, row * 128 + 2, 166, 124);
      ctx.strokeStyle = "rgba(62,68,56,.13)"; ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, row * 128 + 1, 168, 126);
    }
  } else if (kind === "wood") {
    for (let plank = 0; plank < 6; plank++) {
      ctx.fillStyle = "rgba(65,45,26,.17)"; ctx.fillRect(plank * 85, 0, 2, 512);
      ctx.strokeStyle = "rgba(105,72,36,.09)";
      for (let grain = 0; grain < 3; grain++) {
        ctx.beginPath(); ctx.moveTo(plank * 85 + 14 + grain * 22, 0);
        ctx.bezierCurveTo(plank * 85 + 26 + grain * 20, 170, plank * 85 + 8 + grain * 22, 350, plank * 85 + 14 + grain * 22, 512); ctx.stroke();
      }
    }
  } else if (kind === "metal") {
    ctx.strokeStyle = "rgba(40,62,67,.12)"; ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 496, 496); ctx.fillStyle = "rgba(40,62,67,.22)";
    for (const x of [18, 494]) for (const y of [18, 494]) {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === "sand" || kind === "water") {
    ctx.strokeStyle = kind === "sand" ? "rgba(124,100,60,.06)" : "rgba(255,255,255,.19)";
    ctx.lineWidth = kind === "sand" ? 2 : 4;
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(128, y + 12, 384, y - 12, 512, y); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `combat-${kind}-tile`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "floor" || kind === "sand" ? 24 : 3, kind === "floor" || kind === "sand" ? 20 : 3);
  return texture;
};
