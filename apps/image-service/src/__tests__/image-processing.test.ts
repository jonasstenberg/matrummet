import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readdirSync } from "fs";
import { rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import {
  IMAGE_SIZES,
  VALID_SIZES,
  generateImageVariants,
  deleteImageVariants,
} from "../image-processing.js";

const TEST_DIR = "/tmp/image-service-test-processing";

async function createTestImageBuffer(): Promise<Buffer> {
  return sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
}

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
});

describe("IMAGE_SIZES", () => {
  it("has all 5 expected sizes", () => {
    const keys = Object.keys(IMAGE_SIZES);
    expect(keys).toEqual(["thumb", "small", "medium", "large", "full"]);
  });

  it("has correct dimensions for each size", () => {
    expect(IMAGE_SIZES.thumb).toEqual({ width: 320, height: 240 });
    expect(IMAGE_SIZES.small).toEqual({ width: 640, height: 480 });
    expect(IMAGE_SIZES.medium).toEqual({ width: 960, height: 720 });
    expect(IMAGE_SIZES.large).toEqual({ width: 1280, height: 960 });
    expect(IMAGE_SIZES.full).toEqual({ width: 1920, height: 1440 });
  });
});

describe("VALID_SIZES", () => {
  it("matches the keys of IMAGE_SIZES", () => {
    expect(VALID_SIZES).toEqual(Object.keys(IMAGE_SIZES));
  });
});

describe("generateImageVariants", () => {
  it("creates the output directory", async () => {
    const outputDir = join(TEST_DIR, "variant-test");
    const buffer = await createTestImageBuffer();

    await generateImageVariants(buffer, outputDir);

    expect(existsSync(outputDir)).toBe(true);
  });

  it("creates all 5 size variants as webp files", async () => {
    const outputDir = join(TEST_DIR, "all-variants");
    const buffer = await createTestImageBuffer();

    await generateImageVariants(buffer, outputDir);

    const files = readdirSync(outputDir).sort();
    expect(files).toEqual([
      "full.webp",
      "large.webp",
      "medium.webp",
      "small.webp",
      "thumb.webp",
    ]);
  });

  it("creates valid webp images with correct dimensions", async () => {
    const outputDir = join(TEST_DIR, "dimensions-check");
    const buffer = await createTestImageBuffer();

    await generateImageVariants(buffer, outputDir);

    for (const [sizeName, dimensions] of Object.entries(IMAGE_SIZES)) {
      const filePath = join(outputDir, `${sizeName}.webp`);
      const metadata = await sharp(filePath).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(dimensions.width);
      expect(metadata.height).toBe(dimensions.height);
    }
  });

  it("handles nested non-existent directories", async () => {
    const outputDir = join(TEST_DIR, "deep", "nested", "dir");
    const buffer = await createTestImageBuffer();

    await generateImageVariants(buffer, outputDir);

    expect(existsSync(outputDir)).toBe(true);
    expect(readdirSync(outputDir)).toHaveLength(5);
  });
});

describe("deleteImageVariants", () => {
  it("removes the image directory", async () => {
    // Create a directory with some files in the data files dir
    const imageId = "test-delete-id";
    const dataDir = process.env.DATA_FILES_DIR ?? "/tmp/image-service-test";
    const imageDir = join(dataDir, imageId);
    await mkdir(imageDir, { recursive: true });
    await writeFile(join(imageDir, "thumb.webp"), "fake");

    expect(existsSync(imageDir)).toBe(true);

    await deleteImageVariants(imageId);

    expect(existsSync(imageDir)).toBe(false);
  });

  it("does not throw for non-existent directory", async () => {
    await expect(
      deleteImageVariants("non-existent-image-id"),
    ).resolves.not.toThrow();
  });
});
