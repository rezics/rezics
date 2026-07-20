import { StatusCodes } from "http-status-codes";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	GetObjectTaggingCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
	type DeleteObjectCommandInput,
	type GetObjectCommandInput,
	type GetObjectTaggingCommandInput,
	type HeadObjectCommandInput,
	type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { withDependencySpan } from "@rezics/observability";

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
	health(signal?: AbortSignal) {
		return withDependencySpan({ dependency: "s3", operation: "health" }, () =>
			storageClient.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }), {
				abortSignal: signal,
			}),
		);
	},
	put(input: WithoutBucket<PutObjectCommandInput>) {
		return withDependencySpan({ dependency: "s3", operation: "put" }, () =>
			storageClient.send(new PutObjectCommand({ ...input, Bucket: env.S3_BUCKET })),
		);
	},

	get(input: WithoutBucket<GetObjectCommandInput>) {
		return withDependencySpan({ dependency: "s3", operation: "get" }, () =>
			storageClient.send(new GetObjectCommand({ ...input, Bucket: env.S3_BUCKET })),
		);
	},

	getTags(input: WithoutBucket<GetObjectTaggingCommandInput>) {
		return withDependencySpan({ dependency: "s3", operation: "get_tags" }, () =>
			storageClient.send(new GetObjectTaggingCommand({ ...input, Bucket: env.S3_BUCKET })),
		);
	},

	head(input: WithoutBucket<HeadObjectCommandInput>) {
		return withDependencySpan({ dependency: "s3", operation: "head" }, () =>
			storageClient.send(new HeadObjectCommand({ ...input, Bucket: env.S3_BUCKET })),
		);
	},

	delete(input: WithoutBucket<DeleteObjectCommandInput>) {
		return withDependencySpan({ dependency: "s3", operation: "delete" }, () =>
			storageClient.send(new DeleteObjectCommand({ ...input, Bucket: env.S3_BUCKET })),
		);
	},

	presignPut(input: WithoutBucket<PutObjectCommandInput>, expiresIn = env.S3_PRESIGN_EXPIRES_IN) {
		const unhoistableHeaders = new Set([
			...(input.Tagging ? ["x-amz-tagging"] : []),
			...Object.keys(input.Metadata ?? {}).map((key) => `x-amz-meta-${key.toLowerCase()}`),
		]);
		return getSignedUrl(
			storageClient,
			new PutObjectCommand({ ...input, Bucket: env.S3_BUCKET }),
			{ expiresIn, unhoistableHeaders },
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
