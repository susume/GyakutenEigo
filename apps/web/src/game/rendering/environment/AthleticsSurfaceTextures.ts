import * as THREE from "three";

/** Neutral authored tiles keep district paint readable after atlas tinting. */
export const makeAthleticsSurfaceTexture = (kind: "stone" | "wood" | "metal" | "sand", resolution = 512) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = resolution;
  const context = canvas.getContext("2d")!;
  context.scale(resolution / 512, resolution / 512);
  context.fillStyle = kind === "wood" ? "#f4dfbb" : "#f3f6f4";
  context.fillRect(0, 0, 512, 512);
  // A deterministic, quiet grain avoids shimmer at school-device resolution.
  let seed = 271;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
  context.fillStyle = "rgba(48,69,75,.055)";
  for (let index = 0; index < 600; index += 1) context.fillRect(random() * 512, random() * 512, 2, 2);
  if (kind === "wood") {
    for (let plank = 0; plank < 8; plank += 1) {
      context.fillStyle = plank % 2 ? "rgba(149,101,55,.07)" : "rgba(255,255,255,.08)";
      context.fillRect(plank * 64, 0, 64, 512);
      context.fillStyle = "rgba(86,65,42,.24)";
      context.fillRect(plank * 64, 0, 2, 512);
      context.strokeStyle = "rgba(120,86,49,.08)";
      for (let grain = 0; grain < 3; grain += 1) {
        context.beginPath();
        context.moveTo(plank * 64 + 12 + grain * 16, 0);
        context.bezierCurveTo(plank * 64 + 25 + grain * 10, 160, plank * 64 + 6 + grain * 16, 350, plank * 64 + 12 + grain * 16, 512);
        context.stroke();
      }
    }
  } else if (kind === "metal") {
    context.strokeStyle = "rgba(65,89,100,.10)";
    context.lineWidth = 2;
    context.strokeRect(12, 12, 488, 488);
    context.fillStyle = "rgba(65,89,100,.22)";
    for (const x of [24, 488]) for (const y of [24, 488]) {
      context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `athletics-${kind}-tile`;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};
