import { DECAL_MAX_DIMENSION, DECAL_MAX_PROCESSED_BYTES, DECAL_MAX_SOURCE_BYTES } from "@quizstrike/shared";

export interface DecalEditOptions {
  rotation: 0 | 90 | 180 | 270;
  scale: number;
  offsetX: number;
  offsetY: number;
  brightness: number;
  contrast: number;
  posterize: boolean;
  removeLightBackground: boolean;
  outline: boolean;
}

export const DEFAULT_DECAL_EDIT_OPTIONS: DecalEditOptions = {
  rotation: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  brightness: 100,
  contrast: 100,
  posterize: false,
  removeLightBackground: false,
  outline: true
};

export const validateDecalFile = (file: Pick<File, "size" | "type">): string | undefined => {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return "Choose a PNG, JPEG, or WebP image.";
  if (file.size <= 0 || file.size > DECAL_MAX_SOURCE_BYTES) return "Choose an image smaller than 5 MB.";
  return undefined;
};

const posterize = (value: number) => Math.round(value / 51) * 51;

const applyPixelEffects = (context: CanvasRenderingContext2D, size: number, options: DecalEditOptions) => {
  const image = context.getImageData(0, 0, size, size);
  const contrast = options.contrast / 100;
  const brightness = options.brightness / 100;
  for (let index = 0; index < image.data.length; index += 4) {
    let red = ((image.data[index] - 128) * contrast + 128) * brightness;
    let green = ((image.data[index + 1] - 128) * contrast + 128) * brightness;
    let blue = ((image.data[index + 2] - 128) * contrast + 128) * brightness;
    if (options.removeLightBackground && red > 232 && green > 232 && blue > 232) image.data[index + 3] = 0;
    if (options.posterize) {
      red = posterize(red);
      green = posterize(green);
      blue = posterize(blue);
    }
    image.data[index] = Math.max(0, Math.min(255, red));
    image.data[index + 1] = Math.max(0, Math.min(255, green));
    image.data[index + 2] = Math.max(0, Math.min(255, blue));
  }
  context.putImageData(image, 0, 0);
};

const addStickerOutline = (context: CanvasRenderingContext2D, size: number) => {
  const original = context.getImageData(0, 0, size, size);
  const outline = context.createImageData(size, size);
  const radius = Math.max(2, Math.round(size / 96));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const alpha = original.data[(y * size + x) * 4 + 3];
      if (alpha === 0) continue;
      for (let oy = -radius; oy <= radius; oy += 1) {
        for (let ox = -radius; ox <= radius; ox += 1) {
          if (ox * ox + oy * oy > radius * radius) continue;
          const px = x + ox;
          const py = y + oy;
          if (px < 0 || py < 0 || px >= size || py >= size) continue;
          const target = (py * size + px) * 4;
          outline.data[target] = 255;
          outline.data[target + 1] = 255;
          outline.data[target + 2] = 255;
          outline.data[target + 3] = 255;
        }
      }
    }
  }
  context.putImageData(outline, 0, 0);
  const top = document.createElement("canvas");
  top.width = size;
  top.height = size;
  top.getContext("2d")?.putImageData(original, 0, 0);
  context.drawImage(top, 0, 0);
};

export const processDecalImage = async (
  file: File,
  options: DecalEditOptions,
  outputSize = DECAL_MAX_DIMENSION
): Promise<Blob> => {
  const validationError = validateDecalFile(file);
  if (validationError) throw new Error(validationError);
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > 8192 || bitmap.height > 8192) throw new Error("Image dimensions are too large.");
    const size = Math.max(96, Math.min(DECAL_MAX_DIMENSION, Math.round(outputSize)));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser cannot process the image.");
    context.clearRect(0, 0, size, size);
    context.save();
    context.translate(size / 2 + options.offsetX * size * 0.35, size / 2 + options.offsetY * size * 0.35);
    context.rotate((options.rotation * Math.PI) / 180);
    const rotated = options.rotation === 90 || options.rotation === 270;
    const sourceWidth = rotated ? bitmap.height : bitmap.width;
    const sourceHeight = rotated ? bitmap.width : bitmap.height;
    const fit = Math.min(size / sourceWidth, size / sourceHeight) * options.scale;
    context.drawImage(bitmap, -bitmap.width * fit / 2, -bitmap.height * fit / 2, bitmap.width * fit, bitmap.height * fit);
    context.restore();
    applyPixelEffects(context, size, options);
    if (options.outline) addStickerOutline(context, size);
    const preferredType = "image/webp";
    let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, preferredType, 0.82));
    if (!blob || blob.type !== preferredType) blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The decal could not be exported.");
    if (blob.size > DECAL_MAX_PROCESSED_BYTES) throw new Error("The processed decal is still too large. Try a simpler crop.");
    return blob;
  } finally {
    bitmap.close();
  }
};
