import { t } from "elysia";

export const ImageUploadResponse = t.Object({
  url: t.String(),
});

export type ImageUploadResponse = (typeof ImageUploadResponse)["static"];
