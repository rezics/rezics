import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_PRESIGN_EXPIRY = 600; // 10 minutes
const DEFAULT_CACHE_MAX_AGE = 31_536_000; // 1 year

function getS3Client(): S3Client | null {
  const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    region: env.S3_REGION ?? "auto",
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

export function isStorageConfigured(): boolean {
  return !!(
    env.S3_ENDPOINT &&
    env.S3_ACCESS_KEY_ID &&
    env.S3_SECRET_ACCESS_KEY &&
    env.S3_BUCKET &&
    env.MEDIA_PUBLIC_BASE_URL
  );
}

export async function createPresignedUpload(
  contentType: string,
  size: number,
  userId: string,
): Promise<{
  uploadUrl: string;
  fileUrl: string;
  headers: Record<string, string>;
}> {
  if (!isStorageConfigured()) {
    throw new Error("Storage not configured");
  }

  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    throw new Error(
      `Unsupported file type: ${contentType}. Accepted: ${Object.keys(ALLOWED_TYPES).join(", ")}`,
    );
  }

  const maxSize = env.MEDIA_MAX_UPLOAD_SIZE ?? DEFAULT_MAX_SIZE;
  if (size > maxSize) {
    throw new Error(
      `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`,
    );
  }

  const client = getS3Client()!;
  const id = crypto.randomUUID();
  const key = `${userId}/${id}.${ext}`;
  const cacheControl = `public, max-age=${DEFAULT_CACHE_MAX_AGE}, immutable`;

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: env.S3_BUCKET!,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      CacheControl: cacheControl,
    }),
    { expiresIn: env.MEDIA_PRESIGN_EXPIRY ?? DEFAULT_PRESIGN_EXPIRY },
  );

  const publicBaseUrl = env.MEDIA_PUBLIC_BASE_URL!.replace(/\/$/, "");
  return {
    uploadUrl,
    fileUrl: `${publicBaseUrl}/${key}`,
    headers: {
      "content-type": contentType,
      "cache-control": cacheControl,
    },
  };
}
