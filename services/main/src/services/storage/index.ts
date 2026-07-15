import { StatusCodes } from "http-status-codes";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
	type DeleteObjectCommandInput,
	type GetObjectCommandInput,
	type HeadObjectCommandInput,
	type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config";

type WithoutBucket<T> = Omit<T, "Bucket">;

const storageClient = new S3Client({
	endpoint: env.S3_ENDPOINT,
	region: env.S3_REGION,
	forcePathStyle: env.S3_FORCE_PATH_STYLE,
	credentials: {
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
	},
});

export const storage = {
	health() {
		return storageClient.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
	},
	put(input: WithoutBucket<PutObjectCommandInput>) {
		return storageClient.send(new PutObjectCommand({ ...input, Bucket: env.S3_BUCKET }));
	},

	get(input: WithoutBucket<GetObjectCommandInput>) {
		return storageClient.send(new GetObjectCommand({ ...input, Bucket: env.S3_BUCKET }));
	},

	head(input: WithoutBucket<HeadObjectCommandInput>) {
		return storageClient.send(new HeadObjectCommand({ ...input, Bucket: env.S3_BUCKET }));
	},

	delete(input: WithoutBucket<DeleteObjectCommandInput>) {
		return storageClient.send(new DeleteObjectCommand({ ...input, Bucket: env.S3_BUCKET }));
	},

	presignPut(input: WithoutBucket<PutObjectCommandInput>, expiresIn = env.S3_PRESIGN_EXPIRES_IN) {
		return getSignedUrl(
			storageClient,
			new PutObjectCommand({ ...input, Bucket: env.S3_BUCKET }),
			{ expiresIn },
		);
	},

	presignGet(input: WithoutBucket<GetObjectCommandInput>, expiresIn = env.S3_PRESIGN_EXPIRES_IN) {
		return getSignedUrl(
			storageClient,
			new GetObjectCommand({ ...input, Bucket: env.S3_BUCKET }),
			{ expiresIn },
		);
	},
};

export function isStorageNotFound(error: unknown) {
	if (!error || typeof error !== "object") return false;
	if ("name" in error && ["NotFound", "NoSuchKey", "NoSuchObject"].includes(String(error.name)))
		return true;
	if (!("$metadata" in error) || !error.$metadata || typeof error.$metadata !== "object")
		return false;
	return (
		"httpStatusCode" in error.$metadata &&
		Number(error.$metadata.httpStatusCode) === StatusCodes.NOT_FOUND
	);
}
