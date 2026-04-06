import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { isR2Configured, uploadImage } from "./upload.service";

export const uploadApi = new Elysia({ prefix: "/upload" }).use(authMacro).post(
  "/image",
  async ({ body, set }) => {
    if (!isR2Configured()) {
      set.status = 503;
      return { message: "Storage not configured" };
    }

    const file = body.image;
    if (!file) {
      set.status = 400;
      return { message: "Missing image field" };
    }

    try {
      const result = await uploadImage(file);
      return result;
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
    body: t.Object({
      image: t.File({
        maxSize: "5m",
        type: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      }),
    }),
    detail: {
      summary: "Upload image",
      description:
        "Upload an image to R2 storage. Max 5MB, supports JPEG, PNG, WebP, GIF.",
      tags: ["Upload"],
    },
  },
);
