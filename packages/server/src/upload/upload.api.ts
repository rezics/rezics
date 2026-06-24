import { Elysia } from "elysia";
import { PresignUploadBody, PresignUploadResponse } from "@rezics/contract";
import { authMacro } from "@/middleware";
import { AppError } from "@/utils/errors";
import { isStorageConfigured, createPresignedUpload } from "./upload.service";

export const uploadApi = new Elysia({ prefix: "/upload" }).use(authMacro).post(
  "/presign",
  async ({ body, identity }) => {
    if (!isStorageConfigured()) {
      throw new AppError(503, "Storage not configured");
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
        throw new AppError(413, message);
      } else if (message.includes("Unsupported file type")) {
        throw new AppError(415, message);
      }
      throw new AppError(500, message);
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
