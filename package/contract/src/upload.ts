import { t } from "elysia";

export const PresignUploadBody = t.Object({
  contentType: t.String(),
  size: t.Number(),
});
export type PresignUploadBody = (typeof PresignUploadBody)["static"];

export const PresignUploadResponse = t.Object({
  uploadUrl: t.String(),
  fileUrl: t.String(),
  headers: t.Record(t.String(), t.String()),
});
export type PresignUploadResponse = (typeof PresignUploadResponse)["static"];
