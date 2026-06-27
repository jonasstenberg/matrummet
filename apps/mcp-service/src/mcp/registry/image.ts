import { z } from "zod";

import { type ToolContext, type ToolDef, uploadImage } from "../tool.js";

export const imageTools: ToolDef[] = [
  {
    name: "upload_image",
    title: "Upload recipe image",
    description:
      "Upload a recipe image (base64). Returns { filename } — pass that id as the `image` arg to insert_recipe / update_recipe. Max 20 MB; thumbnails are generated automatically.",
    inputSchema: {
      data_base64: z.string().describe("Image bytes, base64-encoded (no data: prefix)"),
      filename: z.string().optional().describe("Original filename (optional)"),
      mime_type: z.string().optional().describe("MIME type, e.g. image/jpeg"),
    },
    annotations: { openWorldHint: true },
    handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const dataBase64 = typeof args.data_base64 === "string" ? args.data_base64 : "";
      if (!dataBase64) throw new Error("data_base64 is required");
      return uploadImage(ctx, {
        dataBase64,
        filename: typeof args.filename === "string" ? args.filename : undefined,
        mimeType: typeof args.mime_type === "string" ? args.mime_type : undefined,
      });
    },
  },
];
