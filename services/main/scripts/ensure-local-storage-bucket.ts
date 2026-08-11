import {
	CreateBucketCommand,
	HeadBucketCommand,
	PutBucketCorsCommand,
	S3Client,
	S3ServiceException,
} from "@aws-sdk/client-s3";

import { env } from "../src/services/config";

const LoopbackHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
const endpoint = new URL(env.S3_ENDPOINT);
const frontendUrlValue = process.env.FRONTEND_URL?.trim();

if (!frontendUrlValue) throw new Error("FRONTEND_URL is required");

let frontendUrl: URL;
try {
	frontendUrl = new URL(frontendUrlValue);
} catch {
	throw new Error("FRONTEND_URL must be an HTTP or HTTPS origin");
}

if (!LoopbackHostnames.has(endpoint.hostname))
	throw new Error(
		`Refusing to prepare a development bucket on non-loopback endpoint ${endpoint.origin}`,
	);
if (
	(frontendUrl.protocol !== "http:" && frontendUrl.protocol !== "https:") ||
	frontendUrl.pathname !== "/" ||
	frontendUrl.search ||
	frontendUrl.hash
)
	throw new Error("FRONTEND_URL must be an HTTP or HTTPS origin");

const client = new S3Client({
	endpoint: env.S3_ENDPOINT,
	region: env.S3_REGION,
	forcePathStyle: env.S3_FORCE_PATH_STYLE,
	requestChecksumCalculation: "WHEN_REQUIRED",
	credentials: {
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
	},
});

try {
	await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
} catch (error: unknown) {
	if (!(error instanceof S3ServiceException) || error.$metadata.httpStatusCode !== 404) throw error;

	try {
		await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
	} catch (createError: unknown) {
		if (
			!(createError instanceof S3ServiceException) ||
			createError.name !== "BucketAlreadyOwnedByYou"
		)
			throw createError;
	}

	await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
}

await client.send(
	new PutBucketCorsCommand({
		Bucket: env.S3_BUCKET,
		CORSConfiguration: {
			CORSRules: [
				{
					AllowedHeaders: [
						"content-type",
						"x-amz-meta-image_asset_id",
						"x-amz-meta-image_object_id",
						"x-amz-meta-uploader_profile_id",
					],
					AllowedMethods: ["PUT"],
					AllowedOrigins: [frontendUrl.origin],
					MaxAgeSeconds: 3_600,
				},
			],
		},
	}),
);

console.info(
	`Local storage bucket is ready: ${env.S3_BUCKET} (uploads allowed from ${frontendUrl.origin})`,
);
