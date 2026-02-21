import sharp from "sharp";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { config } from "./config.js";

export const IMAGE_SIZES = {
  thumb: { width: 320, height: 240 },
  small: { width: 640, height: 480 },
  medium: { width: 960, height: 720 },
  large: { width: 1280, height: 960 },
  full: { width: 1920, height: 1440 },
} as const;

export type ImageSize = keyof typeof IMAGE_SIZES;

export const VALID_SIZES = Object.keys(IMAGE_SIZES) as ImageSize[];

const WEBP_QUALITY = 85;

/**
 * Generate all image size variants from an input buffer.
 * Saves to outputDir with filenames: thumb.webp, small.webp, etc.
 */
export async function generateImageVariants(
  inputBuffer: Buffer,
  outputDir: string,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  await Promise.all(
    Object.entries(IMAGE_SIZES).map(async ([sizeName, dimensions]) => {
      const outputPath = join(outputDir, `${sizeName}.webp`);
      await sharp(inputBuffer)
        .resize(dimensions.width, dimensions.height, {
          fit: "cover",
          position: "center",
        })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outputPath);
    }),
  );
}

/**
 * Delete all image variants for a given image ID.
 */
export async function deleteImageVariants(imageId: string): Promise<void> {
  const imageDir = join(config.dataFilesDir, imageId);
  try {
    await rm(imageDir, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }
}
