import {
	CreateBucketCommand,
	HeadBucketCommand,
	S3Client,
	S3ServiceException,
} from "@aws-sdk/client-s3";

import { env } from "../src/services/config";

const LoopbackHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
const endpoint = new URL(env.S3_ENDPOINT);

if (!LoopbackHostnames.has(endpoint.hostname))
	throw new Error(
		`Refusing to prepare a development bucket on non-loopback endpoint ${endpoint.origin}`,
	);

const client = new S3Client({
	endpoint: env.S3_ENDPOINT,
	region: env.S3_REGION,
	forcePathStyle: env.S3_FORCE_PATH_STYLE,
	credentials: {
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
	},
});

try {
	await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
} catch (error: unknown) {
	if (!(error instanceof S3ServiceException) || error.$metadata.httpStatusCode !== 404)
		throw error;

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

console.info(`Local storage bucket is ready: ${env.S3_BUCKET}`);
