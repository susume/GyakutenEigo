import * as THREE from "three";

export const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

export const makeCanvasTexture = (
  kind: "floor" | "stone" | "wood" | "water" | "sand" | "metal",
  accent = "#e8c67a",
  resolution = 1024
) => {
  const textureResolution = Math.max(256, Math.round(resolution));
  const canvas = document.createElement("canvas");
  canvas.width = textureResolution;
  canvas.height = textureResolution;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(textureResolution / 1024, textureResolution / 1024);
  const palettes = {
    floor: ["#b9ab94", "#f2e7cf"],
    stone: ["#bdb3a7", "#f1e9df"],
    wood: ["#a99482", "#e8d5bd"],
    water: ["#7eb8bd", "#ddfbff"],
    sand: ["#c7b99e", "#f7ebcc"],
    metal: ["#8d9a9e", "#e8eef0"]
  } as const;
  const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
  gradient.addColorStop(0, palettes[kind][0]);
  gradient.addColorStop(1, palettes[kind][1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);

  const random = seededRandom({ floor: 17, stone: 31, wood: 47, water: 59, sand: 71, metal: 83 }[kind]);
  ctx.globalAlpha = kind === "water" ? 0.08 : 0.16;
  for (let index = 0; index < 1100; index += 1) {
    const shade = Math.floor(105 + random() * 115);
    ctx.fillStyle = kind === "water" ? `rgba(210,250,255,.8)` : `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(random() * 1024, random() * 1024, 1 + random() * 4, 1 + random() * 4);
  }
  ctx.globalAlpha = 1;

  if (kind !== "water") {
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = kind === "floor" || kind === "sand" ? 3 : 5;
    const step = kind === "wood" ? 128 : kind === "metal" ? 512 : 256;
    for (let pos = 0; pos <= 1024; pos += step) {
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 1024);
      ctx.moveTo(0, pos);
      ctx.lineTo(1024, pos);
      ctx.stroke();
    }
    if (kind === "stone") {
      ctx.strokeStyle = "rgba(78,54,32,.24)";
      ctx.lineWidth = 5;
      for (let y = 128; y < 1024; y += 128) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(1024, y);
        ctx.stroke();
        const offset = (y / 128) % 2 ? 128 : 0;
        for (let x = offset; x < 1024; x += 256) {
          ctx.beginPath();
          ctx.moveTo(x, y - 128);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    }
    if (kind === "sand" || kind === "floor") {
      ctx.strokeStyle = "rgba(255,241,199,.2)";
      ctx.lineWidth = 3;
      for (let y = 48; y < 1024; y += 72) {
        ctx.beginPath();
        for (let x = 0; x <= 1024; x += 32) {
          const waveY = y + Math.sin((x + y) * 0.018) * 8;
          if (x === 0) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.stroke();
      }
    }
    if (kind === "metal") {
      ctx.fillStyle = "rgba(240,250,252,.2)";
      for (let y = 96; y < 1024; y += 256) {
        for (let x = 96; x < 1024; x += 256) {
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else {
    ctx.strokeStyle = "rgba(190,250,255,.32)";
    ctx.lineWidth = 8;
    for (let pos = -200; pos < 1200; pos += 120) {
      ctx.beginPath();
      ctx.moveTo(pos, 180);
      ctx.bezierCurveTo(pos + 80, 260, pos + 160, 120, pos + 240, 220);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(120, 880);
  ctx.lineTo(904, 880);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "floor" ? 16 : 3, kind === "floor" ? 14 : 3);
  texture.anisotropy = 8;
  return texture;
};

export const makeLabelTexture = (
  label: string,
  color = "#ffffff",
  background = "rgba(41, 28, 16, 0.78)",
  resolution = 768
) => {
  const width = Math.max(128, Math.round(resolution));
  const scale = width / 768;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(64, Math.round(256 * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = background;
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.roundRect(24, 24, 720, 208, 28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "700 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 384, 128, 660);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

