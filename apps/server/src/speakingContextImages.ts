import sharp, { type Metadata } from "sharp";

export const SPEAKING_CONTEXT_IMAGE_LIMITS = {
  maxInputBytes: 10 * 1024 * 1024,
  maxOutputBytes: 300 * 1024,
  maxDimension: 1280,
  maxPixels: 40_000_000
} as const;

const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OUTPUT_QUALITIES = [82, 76, 70, 64, 58, 52, 46] as const;

export class SpeakingContextImageProcessingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "SPEAKING_CONTEXT_IMAGE_TOO_LARGE"
      | "SPEAKING_CONTEXT_IMAGE_UNSUPPORTED"
      | "SPEAKING_CONTEXT_IMAGE_INVALID"
  ) {
    super(message);
    this.name = "SpeakingContextImageProcessingError";
  }
}

const normalizedMimeType = (value: string) => value.split(";", 1)[0]?.trim().toLowerCase() ?? "";

const processingError = (message: string, code: SpeakingContextImageProcessingError["code"]) =>
  new SpeakingContextImageProcessingError(message, code);

export type ProcessedSpeakingContextImage = {
  bytes: Buffer;
  mimeType: "image/webp";
  byteLength: number;
  width: number;
  height: number;
};

/**
 * Validate and normalize a teacher-supplied context image in memory. The
 * returned WebP deliberately has no copied metadata, so EXIF and other
 * source metadata do not become durable application data.
 */
export const processSpeakingContextImage = async (
  input: Uint8Array,
  contentType: string
): Promise<ProcessedSpeakingContextImage> => {
  if (input.byteLength > SPEAKING_CONTEXT_IMAGE_LIMITS.maxInputBytes) {
    throw processingError("That image is too large. Choose an image smaller than 10 MB.", "SPEAKING_CONTEXT_IMAGE_TOO_LARGE");
  }
  const declaredMimeType = normalizedMimeType(contentType);
  if (!SUPPORTED_MIME_TYPES.has(declaredMimeType)) {
    throw processingError("Upload a JPEG, PNG, or WebP image.", "SPEAKING_CONTEXT_IMAGE_UNSUPPORTED");
  }

  const sourceBytes = Buffer.from(input);
  let metadata: Metadata;
  try {
    metadata = await sharp(sourceBytes, { failOn: "error", limitInputPixels: SPEAKING_CONTEXT_IMAGE_LIMITS.maxPixels }).metadata();
  } catch {
    throw processingError("That file is not a readable image. Choose a JPEG, PNG, or WebP file.", "SPEAKING_CONTEXT_IMAGE_INVALID");
  }

  if (!metadata.width || !metadata.height || !metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw processingError("Upload a JPEG, PNG, or WebP image.", "SPEAKING_CONTEXT_IMAGE_UNSUPPORTED");
  }
  if (metadata.width * metadata.height > SPEAKING_CONTEXT_IMAGE_LIMITS.maxPixels) {
    throw processingError("That image is too large to process. Choose a smaller image.", "SPEAKING_CONTEXT_IMAGE_TOO_LARGE");
  }

  const longestEdge = Math.max(metadata.width, metadata.height);
  let scale = Math.min(1, SPEAKING_CONTEXT_IMAGE_LIMITS.maxDimension / longestEdge);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const width = Math.max(1, Math.round(metadata.width * scale));
    const height = Math.max(1, Math.round(metadata.height * scale));
    for (const quality of OUTPUT_QUALITIES) {
      try {
        const encoded = await sharp(sourceBytes, { failOn: "error", limitInputPixels: SPEAKING_CONTEXT_IMAGE_LIMITS.maxPixels })
          .rotate()
          .resize({ width, height, fit: "inside", withoutEnlargement: true })
          .webp({ quality, effort: 4 })
          .toBuffer({ resolveWithObject: true });
        if (encoded.data.byteLength <= SPEAKING_CONTEXT_IMAGE_LIMITS.maxOutputBytes) {
          return {
            bytes: encoded.data,
            mimeType: "image/webp",
            byteLength: encoded.data.byteLength,
            width: encoded.info.width,
            height: encoded.info.height
          };
        }
      } catch {
        throw processingError("That file is not a readable image. Choose a JPEG, PNG, or WebP file.", "SPEAKING_CONTEXT_IMAGE_INVALID");
      }
    }
    scale *= 0.78;
  }

  throw processingError("That image could not be compressed small enough. Choose a simpler or smaller image.", "SPEAKING_CONTEXT_IMAGE_TOO_LARGE");
};
