import { statSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { config } from "../config.js";
import { VALID_SIZES, type ImageSize } from "../image-processing.js";

/**
 * Serve an image variant.
 * Path format: /images/{imageId}/{size}
 * Defaults to 'full' if size is omitted.
 */
export function handleServe(imageId: string, sizeParam?: string): Response {
  // Validate imageId to prevent directory traversal
  if (
    !imageId ||
    imageId.includes("..") ||
    imageId.includes("/") ||
    imageId.includes("\\")
  ) {
    return new Response("Invalid image ID", { status: 400 });
  }

  // Validate and default size
  let size: ImageSize = "full";
  if (sizeParam) {
    if (!VALID_SIZES.includes(sizeParam as ImageSize)) {
      return new Response(
        `Invalid size. Must be one of: ${VALID_SIZES.join(", ")}`,
        { status: 400 },
      );
    }
    size = sizeParam as ImageSize;
  }

  const imagePath = join(config.dataFilesDir, imageId, `${size}.webp`);

  let stats;
  try {
    stats = statSync(imagePath);
  } catch {
    return new Response("Image not found", { status: 404 });
  }

  // Generate ETag based on file stats
  const etag = createHash("md5")
    .update(`${stats.mtime.getTime()}-${stats.size}`)
    .digest("hex");

  return new Response(Bun.file(imagePath), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
      "Content-Length": stats.size.toString(),
    },
  });
}

/**
 * Check If-None-Match for conditional requests (304 Not Modified).
 */
export function handleServeWithConditional(
  request: Request,
  imageId: string,
  sizeParam?: string,
): Response {
  const response = handleServe(imageId, sizeParam);

  // Only check conditional for successful responses
  if (response.status === 200) {
    const etag = response.headers.get("ETag");
    const ifNoneMatch = request.headers.get("if-none-match");
    if (etag && ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }
  }

  return response;
}
