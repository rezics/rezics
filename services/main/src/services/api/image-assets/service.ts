import { and, eq, inArray, isNull } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";

import type { DatabaseTransaction } from "../../database";
import { database } from "../../database";
import { imageAsset, imageObject } from "../../database/schema";
import { isStorageNotFound, storage } from "../../storage";
import {
	ImageAssetContentMismatch,
	ImageAssetInvalidSize,
	ImageAssetInvalidState,
	ImageAssetInUse,
	ImageAssetNotFound,
	ImageAssetUnsupportedType,
	ImageAssetUploadNotFound,
} from "./errors";
import type { CreateImageAssetBody } from "./schema";

const allowedTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const maximumImageBytes = 10_485_760;
const uploadExpiresIn = 900;

export function imageAssetContentUrl(assetId: string): string {
	return `/image-assets/${assetId}/content`;
}

export function imageObjectTracking(input: {
	assetId: string;
	objectId: string;
	uploaderProfileId: string;
}) {
	return {
		image_asset_id: input.assetId,
		image_object_id: input.objectId,
		uploader_profile_id: input.uploaderProfileId,
	};
}

export function imageObjectUploadHeaders(
	tracking: ReturnType<typeof imageObjectTracking>,
	contentType: string,
) {
	return {
		"Content-Type": contentType,
		"x-amz-meta-image_asset_id": tracking.image_asset_id,
		"x-amz-meta-image_object_id": tracking.image_object_id,
		"x-amz-meta-uploader_profile_id": tracking.uploader_profile_id,
		"x-amz-tagging": new URLSearchParams(tracking).toString(),
	};
}

const selection = {
	id: imageAsset.id,
	ownerProfileId: imageAsset.ownerProfileId,
	status: imageAsset.status,
	access: imageAsset.access,
	deletedAt: imageAsset.deletedAt,
	contentType: imageObject.mediaType,
	size: imageObject.byteSize,
	storageKey: imageObject.storageKey,
	objectId: imageObject.id,
	createdAt: imageAsset.createdAt,
	updatedAt: imageAsset.updatedAt,
};

export async function findImageAsset(assetId: string) {
	return (
		await database
			.select(selection)
			.from(imageAsset)
			.innerJoin(imageObject, eq(imageObject.assetId, imageAsset.id))
			.where(and(eq(imageAsset.id, assetId), isNull(imageAsset.deletedAt)))
			.limit(1)
	)[0];
}

type FoundImageAsset = NonNullable<Awaited<ReturnType<typeof findImageAsset>>>;

function presentImageAsset(asset: FoundImageAsset) {
	const {
		ownerProfileId: _ownerProfileId,
		storageKey: _storageKey,
		objectId: _objectId,
		deletedAt: _deletedAt,
		...row
	} = asset;
	return { ...row, contentUrl: imageAssetContentUrl(asset.id) };
}

export async function createImageAsset(profileId: string, input: CreateImageAssetBody) {
	if (!allowedTypes.has(input.contentType)) throw new ImageAssetUnsupportedType();
	const created = await database.transaction(async (tx) => {
		const [asset] = await tx
			.insert(imageAsset)
			.values({
				uploaderProfileId: profileId,
				ownerProfileId: profileId,
				access: input.access ?? "private",
			})
			.returning({
				id: imageAsset.id,
				status: imageAsset.status,
				access: imageAsset.access,
				createdAt: imageAsset.createdAt,
				updatedAt: imageAsset.updatedAt,
			});
		if (!asset) throw new Error("Image asset insertion did not return an id");
		const storageKey = `image-objects/${asset.id}/original`;
		const [object] = await tx
			.insert(imageObject)
			.values({ assetId: asset.id, storageKey })
			.returning({ id: imageObject.id });
		if (!object) throw new Error("Image object insertion did not return an id");
		return { ...asset, objectId: object.id, storageKey };
	});

	const tracking = imageObjectTracking({
		assetId: created.id,
		objectId: created.objectId,
		uploaderProfileId: profileId,
	});
	const headers = imageObjectUploadHeaders(tracking, input.contentType);
	const url = await storage.presignPut(
		{
			Key: created.storageKey,
			ContentType: input.contentType,
			ContentLength: input.size,
			Metadata: tracking,
			Tagging: headers["x-amz-tagging"],
		},
		uploadExpiresIn,
	);
	return {
		id: created.id,
		status: created.status,
		access: created.access,
		contentType: null,
		size: null,
		contentUrl: imageAssetContentUrl(created.id),
		createdAt: created.createdAt,
		updatedAt: created.updatedAt,
		upload: { url, expiresIn: uploadExpiresIn, headers },
	};
}

async function markFailed(assetId: string, storageKey: string) {
	await storage.delete({ Key: storageKey }).catch(() => undefined);
	await database
		.update(imageAsset)
		.set({ status: "failed" })
		.where(and(eq(imageAsset.id, assetId), eq(imageAsset.status, "pending")));
}

export async function completeImageAsset(profileId: string, assetId: string) {
	const asset = await findImageAsset(assetId);
	if (!asset || asset.ownerProfileId !== profileId) throw new ImageAssetNotFound();
	if (asset.status === "ready") return presentImageAsset(asset);
	if (asset.status !== "pending") throw new ImageAssetInvalidState();

	let head;
	try {
		head = await storage.head({ Key: asset.storageKey });
	} catch (error) {
		if (!isStorageNotFound(error)) throw error;
		throw new ImageAssetUploadNotFound();
	}
	if (!head.ContentLength || head.ContentLength > maximumImageBytes) {
		await markFailed(asset.id, asset.storageKey);
		throw new ImageAssetInvalidSize();
	}
	const expectedTracking = imageObjectTracking({
		assetId: asset.id,
		objectId: asset.objectId,
		uploaderProfileId: profileId,
	});
	const tags = await storage.getTags({ Key: asset.storageKey });
	const actualTags = Object.fromEntries(
		(tags.TagSet ?? []).flatMap(({ Key, Value }) => (Key && Value ? [[Key, Value]] : [])),
	);
	if (
		Object.entries(expectedTracking).some(
			([key, value]) => head.Metadata?.[key] !== value || actualTags[key] !== value,
		)
	) {
		await markFailed(asset.id, asset.storageKey);
		throw new ImageAssetContentMismatch();
	}
	const object = await storage.get({ Key: asset.storageKey, Range: "bytes=0-4095" });
	const bytes = await object.Body?.transformToByteArray();
	const detected = bytes ? await fileTypeFromBuffer(bytes) : undefined;
	if (!detected || !allowedTypes.has(detected.mime) || detected.mime !== head.ContentType) {
		await markFailed(asset.id, asset.storageKey);
		throw new ImageAssetContentMismatch();
	}

	await database.transaction(async (tx) => {
		await tx
			.update(imageObject)
			.set({ mediaType: detected.mime, byteSize: head.ContentLength })
			.where(eq(imageObject.assetId, asset.id));
		const [ready] = await tx
			.update(imageAsset)
			.set({ status: "ready" })
			.where(and(eq(imageAsset.id, asset.id), eq(imageAsset.status, "pending")))
			.returning({ id: imageAsset.id });
		if (!ready) throw new ImageAssetInvalidState();
	});
	const completed = await findImageAsset(asset.id);
	if (!completed) throw new ImageAssetNotFound();
	return presentImageAsset(completed);
}

export async function getOwnedImageAsset(profileId: string, assetId: string) {
	const asset = await findImageAsset(assetId);
	if (!asset || asset.ownerProfileId !== profileId) throw new ImageAssetNotFound();
	return presentImageAsset(asset);
}

/** Validate a set of localization image overrides with one ownership query. */
export async function ensureImageAssetsAttachable(
	tx: DatabaseTransaction,
	profileId: string,
	assetIds: readonly (string | null | undefined)[],
): Promise<void> {
	const requestedIds = [
		...new Set(assetIds.filter((assetId): assetId is string => Boolean(assetId))),
	];
	if (!requestedIds.length) return;
	const assets = await tx
		.select({ id: imageAsset.id })
		.from(imageAsset)
		.where(
			and(
				inArray(imageAsset.id, requestedIds),
				eq(imageAsset.ownerProfileId, profileId),
				eq(imageAsset.status, "ready"),
				isNull(imageAsset.deletedAt),
			),
		);
	if (assets.length !== requestedIds.length) throw new ImageAssetNotFound();
}

export async function deletePendingImageAsset(profileId: string, assetId: string) {
	const asset = await findImageAsset(assetId);
	if (!asset || asset.ownerProfileId !== profileId) throw new ImageAssetNotFound();
	if (asset.status === "ready") throw new ImageAssetInUse();
	await storage.delete({ Key: asset.storageKey }).catch((error: unknown) => {
		if (!isStorageNotFound(error)) throw error;
	});
	await database
		.update(imageAsset)
		.set({ deletedAt: new Date() })
		.where(and(eq(imageAsset.id, asset.id), isNull(imageAsset.deletedAt)));
}
