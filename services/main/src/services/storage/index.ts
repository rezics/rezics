import { StatusCodes } from "http-status-codes";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
	type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { withDependencySpan } from "@rezics/observability";

import { env } from "../config";

type StorageObjectInput = Readonly<Pick<PutObjectCommandInput, "Key">>;
type StoragePutInput = Readonly<
	Pick<
		PutObjectCommandInput,
		"Body" | "CacheControl" | "ContentLength" | "ContentType" | "Key" | "Metadata"
	>
>;

const storageClient = new S3Client({
	endpoint: env.S3_ENDPOINT,
	region: env.S3_REGION,
	forcePathStyle: env.S3_FORCE_PATH_STYLE,
	requestChecksumCalculation: "WHEN_REQUIRED",
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
	put(input: StoragePutInput) {
		return withDependencySpan({ dependency: "s3", operation: "put" }, () =>
			storageClient.send(new PutObjectCommand({ ...input, Bucket: env.S3_BUCKET })),
		);
	},

	get(input: StorageObjectInput) {
		return withDependencySpan({ dependency: "s3", operation: "get" }, () =>
			storageClient.send(new GetObjectCommand({ ...input, Bucket: env.S3_BUCKET })),
		);
	},

	head(input: StorageObjectInput) {
		return withDependencySpan({ dependency: "s3", operation: "head" }, () =>
			storageClient.send(new HeadObjectCommand({ ...input, Bucket: env.S3_BUCKET })),
		);
	},

	delete(input: StorageObjectInput) {
		return withDependencySpan({ dependency: "s3", operation: "delete" }, () =>
			storageClient.send(new DeleteObjectCommand({ ...input, Bucket: env.S3_BUCKET })),
		);
	},

	presignPut(input: StoragePutInput, expiresIn = env.S3_PRESIGN_EXPIRES_IN) {
		const unhoistableHeaders = new Set(
			Object.keys(input.Metadata ?? {}).map((key) => `x-amz-meta-${key.toLowerCase()}`),
		);
		return getSignedUrl(
			storageClient,
			new PutObjectCommand({ ...input, Bucket: env.S3_BUCKET }),
			{ expiresIn, unhoistableHeaders },
		);
	},

	presignGet(input: StorageObjectInput, expiresIn = env.S3_PRESIGN_EXPIRES_IN) {
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
