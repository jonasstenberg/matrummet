import { getOptionalEnv } from "@matrummet/shared";
import { join, resolve } from "path";

export const config = {
  port: parseInt(getOptionalEnv("PORT", "4006"), 10),
  dataFilesDir:
    process.env.DATA_FILES_DIR ||
    join(resolve(process.cwd(), "../web"), "public", "uploads"),
  maxFileSize: 20 * 1024 * 1024, // 20MB
} as const;
