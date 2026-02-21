import type { Logger } from "pino";
import { authenticateRequest } from "../auth.js";
import { deleteImageVariants } from "../image-processing.js";

export async function handleDelete(
  request: Request,
  imageId: string,
  logger: Logger,
): Promise<Response> {
  // Authenticate
  try {
    authenticateRequest(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate imageId
  if (
    !imageId ||
    imageId.includes("..") ||
    imageId.includes("/") ||
    imageId.includes("\\")
  ) {
    return Response.json({ error: "Invalid image ID" }, { status: 400 });
  }

  try {
    await deleteImageVariants(imageId);
    logger.info({ imageId }, "Image deleted");
    return Response.json({ success: true });
  } catch (error) {
    logger.error({ error, imageId }, "Delete error");
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
