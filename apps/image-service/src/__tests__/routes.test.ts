/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  afterAll,
  beforeAll,
  beforeEach,
} from "vitest";
import { existsSync, readFileSync } from "fs";
import { rm, readdir } from "fs/promises";
import { join } from "path";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import { handleHealth } from "../routes/health.js";
import { handleUpload } from "../routes/upload.js";
import { handleDelete } from "../routes/delete.js";
import { generateImageVariants } from "../image-processing.js";

const SECRET = process.env.JWT_SECRET ?? "test-secret-min-32-chars-long-enough";
const DATA_DIR = process.env.DATA_FILES_DIR ?? "/tmp/image-service-test-routes";

// Provide a global Bun.file() shim for vitest (Node environment).
// serve.ts uses `new Response(Bun.file(path))` to stream image files.
// We replace it with a simple readFileSync-backed Blob so the Response is
// constructable outside of Bun.
const globalAny = globalThis as Record<string, unknown>;
if (!globalAny.Bun) {
  globalAny.Bun = {
    file: (path: string) => {
      const data = readFileSync(path);
      return new Blob([data], { type: "image/webp" });
    },
  };
}

// Import serve handlers AFTER Bun shim is in place
const { handleServe, handleServeWithConditional } = await import(
  "../routes/serve.js"
);

function createMockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: "info",
    silent: vi.fn(),
  } as unknown as import("pino").Logger;
}

let mockLogger: import("pino").Logger;

function createAuthToken(email = "test@test.com"): string {
  return jwt.sign({ role: "authenticated", email }, SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

function authHeaders(email?: string): HeadersInit {
  return { Authorization: `Bearer ${createAuthToken(email)}` };
}

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

function createImageFormData(
  buffer: Buffer,
  filename = "test.jpg",
  type = "image/jpeg",
): FormData {
  const formData = new FormData();
  const file = new File([buffer], filename, { type });
  formData.append("file", file);
  return formData;
}

// ─── Health ────────────────────────────────────────────────────────────

describe("handleHealth", () => {
  it('returns { status: "ok" }', async () => {
    const response = handleHealth();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});

// ─── Upload ────────────────────────────────────────────────────────────

describe("handleUpload", () => {
  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await rm(DATA_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it("returns 401 without authentication", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
    });

    const response = await handleUpload(request, mockLogger);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when no file is provided", async () => {
    const formData = new FormData();
    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });

    const response = await handleUpload(request, mockLogger);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("fil");
  });

  it("returns 400 for non-image file type", async () => {
    const formData = new FormData();
    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    formData.append("file", file);

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });

    const response = await handleUpload(request, mockLogger);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("bild");
  });

  it("returns filename UUID on successful upload", async () => {
    const buffer = await createTestImageBuffer();
    const formData = createImageFormData(buffer);

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });

    const response = await handleUpload(request, mockLogger);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.filename).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("creates image variant files on disk", async () => {
    const buffer = await createTestImageBuffer();
    const formData = createImageFormData(buffer);

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });

    const response = await handleUpload(request, mockLogger);
    const body = await response.json();
    const imageDir = join(DATA_DIR, body.filename);

    expect(existsSync(imageDir)).toBe(true);
    const files = await readdir(imageDir);
    expect(files).toHaveLength(5);
    expect(files.sort()).toEqual([
      "full.webp",
      "large.webp",
      "medium.webp",
      "small.webp",
      "thumb.webp",
    ]);
  });

  it("logs the upload on success", async () => {
    const buffer = await createTestImageBuffer();
    const formData = createImageFormData(buffer);

    const request = new Request("http://localhost/upload", {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });

    await handleUpload(request, mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ imageId: expect.any(String) }),
      "Image uploaded",
    );
  });
});

// ─── Serve ─────────────────────────────────────────────────────────────

describe("handleServe", () => {
  const IMAGE_ID = "serve-test-image";

  beforeAll(async () => {
    const buffer = await createTestImageBuffer();
    const imageDir = join(DATA_DIR, IMAGE_ID);
    await generateImageVariants(buffer, imageDir);
  });

  afterAll(async () => {
    await rm(join(DATA_DIR, IMAGE_ID), { recursive: true, force: true }).catch(
      () => {},
    );
  });

  it("returns 400 for directory traversal attempts", () => {
    const response = handleServe("../etc/passwd");
    expect(response.status).toBe(400);
  });

  it("returns 400 for imageId containing slashes", () => {
    expect(handleServe("foo/bar").status).toBe(400);
    expect(handleServe("foo\\bar").status).toBe(400);
  });

  it("returns 400 for empty imageId", () => {
    expect(handleServe("").status).toBe(400);
  });

  it("returns 400 for invalid size", () => {
    const response = handleServe(IMAGE_ID, "giant");
    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent image", () => {
    const response = handleServe("non-existent-uuid");
    expect(response.status).toBe(404);
  });

  it("serves an existing image with correct headers", () => {
    const response = handleServe(IMAGE_ID, "thumb");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    expect(response.headers.get("ETag")).toBeTruthy();
    expect(response.headers.get("Content-Length")).toBeTruthy();
  });

  it("defaults to full size when no size is given", () => {
    const response = handleServe(IMAGE_ID);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });

  it("serves all valid sizes", () => {
    for (const size of ["thumb", "small", "medium", "large", "full"]) {
      const response = handleServe(IMAGE_ID, size);
      expect(response.status).toBe(200);
    }
  });
});

// ─── Serve with conditional ────────────────────────────────────────────

describe("handleServeWithConditional", () => {
  const IMAGE_ID = "conditional-test-image";

  beforeAll(async () => {
    const buffer = await createTestImageBuffer();
    const imageDir = join(DATA_DIR, IMAGE_ID);
    await generateImageVariants(buffer, imageDir);
  });

  afterAll(async () => {
    await rm(join(DATA_DIR, IMAGE_ID), { recursive: true, force: true }).catch(
      () => {},
    );
  });

  it("returns 200 on first request", () => {
    const request = new Request("http://localhost/images/" + IMAGE_ID);
    const response = handleServeWithConditional(request, IMAGE_ID);

    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBeTruthy();
  });

  it("returns 304 when ETag matches If-None-Match", () => {
    // First request to get the ETag
    const firstRequest = new Request("http://localhost/images/" + IMAGE_ID);
    const firstResponse = handleServeWithConditional(
      firstRequest,
      IMAGE_ID,
      "thumb",
    );
    const etag = firstResponse.headers.get("ETag") ?? "";

    // Second request with matching ETag
    const secondRequest = new Request("http://localhost/images/" + IMAGE_ID, {
      headers: { "If-None-Match": etag },
    });
    const secondResponse = handleServeWithConditional(
      secondRequest,
      IMAGE_ID,
      "thumb",
    );

    expect(secondResponse.status).toBe(304);
  });

  it("returns 200 when ETag does not match If-None-Match", () => {
    const request = new Request("http://localhost/images/" + IMAGE_ID, {
      headers: { "If-None-Match": "stale-etag" },
    });
    const response = handleServeWithConditional(request, IMAGE_ID, "thumb");

    expect(response.status).toBe(200);
  });

  it("passes through error responses without conditional check", () => {
    const request = new Request("http://localhost/images/../etc");
    const response = handleServeWithConditional(request, "../etc");

    expect(response.status).toBe(400);
  });
});

// ─── Delete ────────────────────────────────────────────────────────────

describe("handleDelete", () => {
  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await rm(DATA_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it("returns 401 without authentication", async () => {
    const request = new Request("http://localhost/images/some-id", {
      method: "DELETE",
    });

    const response = await handleDelete(request, "some-id", mockLogger);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 for directory traversal imageId", async () => {
    const request = new Request("http://localhost/images/../etc", {
      method: "DELETE",
      headers: authHeaders(),
    });

    const response = await handleDelete(request, "../etc", mockLogger);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid");
  });

  it("returns 400 for empty imageId", async () => {
    const request = new Request("http://localhost/images/", {
      method: "DELETE",
      headers: authHeaders(),
    });

    const response = await handleDelete(request, "", mockLogger);

    expect(response.status).toBe(400);
  });

  it("returns success for existing image", async () => {
    // Create an image first
    const imageId = "delete-me-image";
    const imageDir = join(DATA_DIR, imageId);
    const buffer = await createTestImageBuffer();
    await generateImageVariants(buffer, imageDir);

    expect(existsSync(imageDir)).toBe(true);

    const request = new Request(`http://localhost/images/${imageId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    const response = await handleDelete(request, imageId, mockLogger);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(existsSync(imageDir)).toBe(false);
  });

  it("returns success even if image does not exist (idempotent)", async () => {
    const request = new Request(
      "http://localhost/images/non-existent-image-id",
      {
        method: "DELETE",
        headers: authHeaders(),
      },
    );

    const response = await handleDelete(
      request,
      "non-existent-image-id",
      mockLogger,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("logs the deletion on success", async () => {
    const imageId = "log-delete-test";
    const request = new Request(`http://localhost/images/${imageId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    await handleDelete(request, imageId, mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ imageId }),
      "Image deleted",
    );
  });
});
