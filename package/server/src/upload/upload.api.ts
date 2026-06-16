import { Elysia } from "elysia";
import { PresignUploadBody, PresignUploadResponse } from "@rezics/contract";
import { authMacro } from "@/middleware";
import { isStorageConfigured, createPresignedUpload } from "./upload.service";

export const uploadApi = new Elysia({ prefix: "/upload" }).use(authMacro).post(
  "/presign",
  async ({ body, identity, set }) => {
    if (!isStorageConfigured()) {
      set.status = 503;
      return { message: "Storage not configured" };
    }

    try {
      return await createPresignedUpload(
        body.contentType,
        body.size,
        identity!.userId,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      if (message.includes("too large")) {
        set.status = 413;
      } else if (message.includes("Unsupported file type")) {
        set.status = 415;
      } else {
        set.status = 500;
      }
      return { message };
    }
  },
  {
    requireLogin: true,
    body: PresignUploadBody,
    response: { 200: PresignUploadResponse },
    detail: {
      summary: "Request presigned upload URL",
      description:
        "Request a presigned S3 URL for direct browser upload. Supports JPEG, PNG, WebP, GIF, AVIF, SVG.",
      tags: ["Upload"],
    },
  },
);
