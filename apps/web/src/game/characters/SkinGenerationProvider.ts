export type ApprovedSkinStyle = "colourful_sticker" | "geometric_pattern" | "pixel_badge" | "classroom_mascot";

export interface GeneratedSkinResult {
  assetId: string;
  style: ApprovedSkinStyle;
}

export interface SkinGenerationProvider {
  readonly configured: boolean;
  generateFromImage(source: Blob, style: ApprovedSkinStyle): Promise<GeneratedSkinResult>;
}

export const unavailableSkinGenerationProvider: SkinGenerationProvider = {
  configured: false,
  async generateFromImage() {
    throw new Error("AI designs are unavailable. Your drawing can still be used as a regular sticker.");
  }
};
