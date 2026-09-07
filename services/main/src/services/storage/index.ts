import { StatusCodes } from "http-status-codes";
import {
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetBucketVersioningCommand,
	ListObjectsV2Command,
	ListObjectVersionsCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
	type PutObjectCommandInput,
	type GetBucketVersioningCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { withDependencySpan } from "@rezics/observability";

import { env } from "../config";

type StorageObjectInput = Readonly<Pick<PutObjectCommandInput, "Key">>;
type StoragePutInput = Readonly<
	Pick<
		PutObjectCommandInput,
		"Body" | "CacheControl" | "ContentLength" | "ContentType" | "Key" | "Metadata" | "IfNoneMatch"
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
	put(input: StoragePutInput, options?: { signal?: AbortSignal }) {
		return withDependencySpan({ dependency: "s3", operation: "put" }, () =>
			storageClient.send(new PutObjectCommand({ ...input, Bucket: env.S3_BUCKET }), {
				abortSignal: options?.signal,
			}),
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

	/** Bounded erasure page includes historical versions when the bucket has ever enabled versioning. */
	async listErasurePage(prefix: string) {
		if (!/^image-objects\/[0-9a-f-]{36}\/$/u.test(prefix))
			throw new Error("Image erasure prefix is invalid");
		const r2 = new URL(env.S3_ENDPOINT).hostname.endsWith(".r2.cloudflarestorage.com");
		let versioning: GetBucketVersioningCommandOutput | undefined;
		try {
			versioning = await storageClient.send(
				new GetBucketVersioningCommand({ Bucket: env.S3_BUCKET }),
			);
		} catch (cause) {
			const unsupported = cause instanceof Error && cause.name === "NotImplemented";
			if (!r2 || !unsupported) throw cause;
		}
		if (versioning?.Status === "Enabled" || versioning?.Status === "Suspended") {
			const page = await storageClient.send(
				new ListObjectVersionsCommand({ Bucket: env.S3_BUCKET, Prefix: prefix, MaxKeys: 500 }),
			);
			return {
				truncated: page.IsTruncated ?? false,
				objects: [
					...(page.Versions ?? []).map((object) => ({
						key: object.Key,
						versionId: object.VersionId,
						size: object.Size,
					})),
					...(page.DeleteMarkers ?? []).map((object) => ({
						key: object.Key,
						versionId: object.VersionId,
						size: undefined,
					})),
				],
			};
		}
		const page = await storageClient.send(
			new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: prefix, MaxKeys: 500 }),
		);
		return {
			truncated: page.IsTruncated ?? false,
			objects: (page.Contents ?? []).map((object) => ({
				key: object.Key,
				versionId: undefined,
				size: object.Size,
			})),
		};
	},
	async deleteErasurePage(objects: readonly { key: string; versionId?: string }[]) {
		if (!objects.length || objects.length > 500)
			throw new Error("Object erasure batch must contain 1 to 500 objects");
		const result = await storageClient.send(
			new DeleteObjectsCommand({
				Bucket: env.S3_BUCKET,
				Delete: {
					Quiet: true,
					Objects: objects.map((object) => ({ Key: object.key, VersionId: object.versionId })),
				},
			}),
		);
		if (result.Errors?.length)
			throw new Error(`Object erasure failed for ${result.Errors.length} objects`);
	},

	presignPut(input: StoragePutInput, expiresIn = env.S3_PRESIGN_EXPIRES_IN) {
		const unhoistableHeaders = new Set(
			Object.keys(input.Metadata ?? {}).map((key) => `x-amz-meta-${key.toLowerCase()}`),
		);
		return getSignedUrl(storageClient, new PutObjectCommand({ ...input, Bucket: env.S3_BUCKET }), {
			expiresIn,
			unhoistableHeaders,
			...(input.IfNoneMatch === "*" ? { signableHeaders: new Set(["if-none-match"]) } : {}),
		});
	},

	presignGet(input: StorageObjectInput, expiresIn = env.S3_PRESIGN_EXPIRES_IN) {
		return getSignedUrl(storageClient, new GetObjectCommand({ ...input, Bucket: env.S3_BUCKET }), {
			expiresIn,
		});
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
