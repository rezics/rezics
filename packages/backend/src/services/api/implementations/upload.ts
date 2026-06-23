import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Effect, Option, Redacted } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Config } from "../../config/index.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  PresignedUpload,
  UploadStorageUnavailable,
  UploadTooLarge,
  UploadUnsupportedType,
} from "../interfaces/upload.ts";

// Allowed content types → file extensions / 允许的内容类型 → 文件扩展名
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

// Cache header for immutable media assets / 不可变媒体资源的缓存头
const CACHE_MAX_AGE = 31_536_000;

export const UploadHandlers = HttpApiBuilder.group(
  Api,
  "upload",
  Effect.fn(function* (handlers) {
    const config = yield* Config;

    return handlers.handle("presign", ({ payload }) =>
      Effect.gen(function* () {
        const user = yield* CurrentUser;

        // Verify S3 storage is configured / 验证 S3 存储已配置
        const s3Config = Option.getOrUndefined(config.s3);
        if (!s3Config) return yield* new UploadStorageUnavailable();

        // Validate content type / 验证内容类型
        const ext = ALLOWED_TYPES[payload.contentType];
        if (!ext) return yield* new UploadUnsupportedType();

        // Validate file size / 验证文件大小
        if (payload.size > config.media.maxUploadSize) return yield* new UploadTooLarge();

        // Build S3 client / 构建 S3 客户端
        const client = new S3Client({
          region: s3Config.region,
          endpoint: s3Config.endpoint,
          credentials: {
            accessKeyId: Redacted.value(s3Config.accessKeyId),
            secretAccessKey: Redacted.value(s3Config.secretAccessKey),
          },
          forcePathStyle: true,
        });

        const id = crypto.randomUUID();
        const key = `${user.id}/${id}.${ext}`;
        const cacheControl = `public, max-age=${CACHE_MAX_AGE}, immutable`;

        // Generate presigned URL / 生成预签名 URL
        const uploadUrl = yield* Effect.tryPromise({
          try: () =>
            getSignedUrl(
              client,
              new PutObjectCommand({
                Bucket: s3Config.bucket,
                Key: key,
                ContentType: payload.contentType,
                ContentLength: payload.size,
                CacheControl: cacheControl,
              }),
              { expiresIn: config.media.presignExpiry },
            ),
          catch: () => new UploadStorageUnavailable(),
        });

        const publicBaseUrl = config.media.publicBaseUrl.replace(/\/$/, "");

        return new PresignedUpload({
          uploadUrl,
          fileUrl: `${publicBaseUrl}/${key}`,
          headers: {
            "content-type": payload.contentType,
            "cache-control": cacheControl,
          },
        });
      }).pipe(Effect.orDie),
    );
  }),
);
