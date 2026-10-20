/** Fit any context image without cropping it or assuming a particular asset size. */
export function speakingImageFitWidth(viewport: { width: number; height: number }, image: { width: number; height: number }) {
  if (viewport.width <= 0 || viewport.height <= 0) return 0;
  if (image.width <= 0 || image.height <= 0) return viewport.width;
  return Math.min(viewport.width, viewport.height * image.width / image.height);
}
