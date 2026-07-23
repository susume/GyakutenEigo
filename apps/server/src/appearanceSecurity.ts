import { DECAL_MAX_DIMENSION, DECAL_MAX_PROCESSED_BYTES } from "@quizstrike/shared";

export type ProcessedImageMime = "image/png" | "image/webp";

export const inspectProcessedDecal = (bytes: Uint8Array, declaredMime: unknown): ProcessedImageMime | undefined => {
  if (bytes.byteLength === 0 || bytes.byteLength > DECAL_MAX_PROCESSED_BYTES) return undefined;
  const isPng = bytes.byteLength >= 33
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR";
  const uint32be = (offset: number) => ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  const pngWidth = isPng ? uint32be(16) : 0;
  const pngHeight = isPng ? uint32be(20) : 0;
  const validPngSize = pngWidth > 0 && pngHeight > 0 && pngWidth <= DECAL_MAX_DIMENSION && pngHeight <= DECAL_MAX_DIMENSION;
  if (isPng && validPngSize && declaredMime === "image/png") return "image/png";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const isWebp = bytes.byteLength >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (!isWebp || declaredMime !== "image/webp") return undefined;
  const chunk = ascii(12, 16);
  let width = 0;
  let height = 0;
  if (chunk === "VP8X" && bytes.byteLength >= 30) {
    width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
  } else if (chunk === "VP8 " && bytes.byteLength >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
  } else if (chunk === "VP8L" && bytes.byteLength >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
  }
  return width > 0 && height > 0 && width <= DECAL_MAX_DIMENSION && height <= DECAL_MAX_DIMENSION
    ? "image/webp"
    : undefined;
};
