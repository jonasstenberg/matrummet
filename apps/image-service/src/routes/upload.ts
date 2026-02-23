import { randomUUID } from "crypto";
import { join } from "path";
import type { Logger } from "@matrummet/shared";
import { authenticateRequest } from "../auth.js";
import { config } from "../config.js";
import { generateImageVariants } from "../image-processing.js";

export async function handleUpload(
  request: Request,
  logger: Logger,
): Promise<Response> {
  // Authenticate (cookie, Bearer JWT, or x-api-key)
  let caller: { email?: string; role?: string };
  try {
    caller = await authenticateRequest(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = logger.child({ email: caller.email });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "Ingen fil uppladdad" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return Response.json(
        { error: "Endast bildfiler är tillåtna" },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > config.maxFileSize) {
      return Response.json(
        { error: "Bilden får vara max 20 MB" },
        { status: 400 },
      );
    }

    // Generate unique image ID
    const imageId = randomUUID();
    const imageDir = join(config.dataFilesDir, imageId);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);

    // Generate all image size variants
    await generateImageVariants(inputBuffer, imageDir);

    log.info({ imageId }, "Image uploaded");

    return Response.json({ filename: imageId });
  } catch (error) {
    log.error({ error }, "Upload error");
    return Response.json(
      { error: "Uppladdning misslyckades" },
      { status: 500 },
    );
  }
}
