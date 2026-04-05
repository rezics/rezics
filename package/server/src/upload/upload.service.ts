import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3';
import {env} from '../env';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function getR2Client(): S3Client | null {
  const {R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY} = env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export function isR2Configured(): boolean {
  return !!(
    env.R2_ENDPOINT &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET &&
    env.R2_PUBLIC_URL
  );
}

export async function uploadImage(
  file: File,
): Promise<{url: string}> {
  if (!isR2Configured()) {
    throw new Error('Storage not configured');
  }

  const mimeType = file.type;
  if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Accepted: ${ALLOWED_MIME_TYPES.join(', ')}`,
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File too large. Maximum size is 5MB.`);
  }

  const client = getR2Client()!;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID();
  const ext = MIME_TO_EXT[mimeType] ?? 'bin';
  const key = `images/${year}/${month}/${id}.${ext}`;

  const buffer = await file.arrayBuffer();

  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: mimeType,
    }),
  );

  const publicUrl = `${env.R2_PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
  return {url: publicUrl};
}
