import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "./middlewares/auth.ts";

// -- Response schemas 响应模型 --

export class PresignedUpload extends Schema.Class<PresignedUpload>("PresignedUpload")({
  uploadUrl: Schema.String,
  fileUrl: Schema.String,
  headers: Schema.Record(Schema.String, Schema.String),
}) {}

// -- Errors 错误 --

export class UploadUnsupportedType extends Schema.TaggedErrorClass<UploadUnsupportedType>()(
  "UploadUnsupportedType",
  {},
  { httpApiStatus: 415 },
) {}

export class UploadTooLarge extends Schema.TaggedErrorClass<UploadTooLarge>()(
  "UploadTooLarge",
  {},
  { httpApiStatus: 413 },
) {}

export class UploadStorageUnavailable extends Schema.TaggedErrorClass<UploadStorageUnavailable>()(
  "UploadStorageUnavailable",
  {},
  { httpApiStatus: 503 },
) {}

// -- Group 接口组 --

export class UploadGroup extends HttpApiGroup.make("upload")
  .add(
    HttpApiEndpoint.post("presign", "/presign", {
      payload: Schema.Struct({
        contentType: Schema.String,
        size: Schema.Int,
        filename: Schema.optional(Schema.String),
      }),
      success: PresignedUpload,
      error: [UploadUnsupportedType, UploadTooLarge, UploadStorageUnavailable, HttpApiError.InternalServerError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/upload") {}
