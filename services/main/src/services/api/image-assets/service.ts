import { and, eq, isNull, or, sql } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import { env } from "../../config";
import type { DatabaseTransaction } from "../../database";
import { database } from "../../database";
import {
	imageAsset,
	imageAssetPresentation,
	imageObject,
	type ImageAssetPresentationRole,
} from "../../database/schema";
import { isStorageNotFound, storage } from "../../storage";
import {
	ImageAssetContentMismatch,
	ImageAssetInvalidPresentation,
	ImageAssetInvalidSize,
	ImageAssetInvalidState,
	ImageAssetInUse,
	ImageAssetNotFound,
	ImageAssetUnsupportedType,
	ImageAssetUploadNotFound,
} from "./errors";
import {
	defaultImageAssetPresentation,
	imageAssetPresentationContentUrl,
	toImageAssetPresentationColumns,
	validateImageAssetPresentation,
} from "./presentation";
import type {
	CompleteImageAssetBody,
	CreateImageAssetBody,
	UpsertImageAssetPresentationBody,
} from "./schema";

const allowedTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const maximumImageBytes = 10_485_760;
const maximumImagePixels = 40_000_000;
const maximumImageDimension = 32_768;

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
	width: imageObject.width,
	height: imageObject.height,
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

const presentationSelection = {
	role: imageAssetPresentation.role,
	fit: imageAssetPresentation.fit,
	cropX: imageAssetPresentation.cropX,
	cropY: imageAssetPresentation.cropY,
	cropWidth: imageAssetPresentation.cropWidth,
	cropHeight: imageAssetPresentation.cropHeight,
	revision: imageAssetPresentation.revision,
};

type StoredImageAssetPresentation = typeof imageAssetPresentation.$inferSelect;

function presentImageAssetPresentation(
	assetId: string,
	presentation: Pick<StoredImageAssetPresentation, keyof typeof presentationSelection>,
) {
	const crop =
		presentation.fit === "crop" &&
		presentation.cropX !== null &&
		presentation.cropY !== null &&
		presentation.cropWidth !== null &&
		presentation.cropHeight !== null
			? {
					x: presentation.cropX,
					y: presentation.cropY,
					width: presentation.cropWidth,
					height: presentation.cropHeight,
				}
			: null;
	if (presentation.fit === "crop" && !crop)
		throw new Error("Stored crop presentation is incomplete");
	return {
		role: presentation.role,
		fit: presentation.fit,
		crop,
		revision: presentation.revision,
		contentUrl: imageAssetPresentationContentUrl(assetId, presentation.role, presentation.revision),
	};
}

async function listImageAssetPresentations(assetId: string) {
	const rows = await database
		.select(presentationSelection)
		.from(imageAssetPresentation)
		.where(eq(imageAssetPresentation.assetId, assetId))
		.orderBy(imageAssetPresentation.role);
	return rows.map((row) => presentImageAssetPresentation(assetId, row));
}

export async function findImageAssetPresentation(
	assetId: string,
	role: ImageAssetPresentationRole,
) {
	return (
		await database
			.select(presentationSelection)
			.from(imageAssetPresentation)
			.where(
				and(eq(imageAssetPresentation.assetId, assetId), eq(imageAssetPresentation.role, role)),
			)
			.limit(1)
	)[0];
}

async function presentImageAsset(asset: FoundImageAsset) {
	const {
		ownerProfileId: _ownerProfileId,
		storageKey: _storageKey,
		objectId: _objectId,
		deletedAt: _deletedAt,
		...row
	} = asset;
	return {
		...row,
		contentUrl: imageAssetContentUrl(asset.id),
		presentations: await listImageAssetPresentations(asset.id),
	};
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
		},
		env.S3_PRESIGN_EXPIRES_IN,
	);
	return {
		id: created.id,
		status: created.status,
		access: created.access,
		contentType: null,
		size: null,
		width: null,
		height: null,
		contentUrl: imageAssetContentUrl(created.id),
		presentations: [],
		createdAt: created.createdAt,
		updatedAt: created.updatedAt,
		upload: { url, expiresIn: env.S3_PRESIGN_EXPIRES_IN, headers },
	};
}

async function markFailed(assetId: string, storageKey: string) {
	await storage.delete({ Key: storageKey }).catch(() => undefined);
	await database
		.update(imageAsset)
		.set({ status: "failed" })
		.where(and(eq(imageAsset.id, assetId), eq(imageAsset.status, "pending")));
}

async function ensureDefaultPresentation(
	tx: DatabaseTransaction,
	assetId: string,
	role: ImageAssetPresentationRole,
	width: number,
	height: number,
): Promise<void> {
	const input = defaultImageAssetPresentation(role, width, height);
	await tx
		.insert(imageAssetPresentation)
		.values({
			assetId,
			role,
			...toImageAssetPresentationColumns(input),
		})
		.onConflictDoNothing({
			target: [imageAssetPresentation.assetId, imageAssetPresentation.role],
		});
}

export async function completeImageAsset(
	profileId: string,
	assetId: string,
	input: CompleteImageAssetBody,
) {
	const asset = await findImageAsset(assetId);
	if (!asset || asset.ownerProfileId !== profileId) throw new ImageAssetNotFound();
	if (asset.status === "ready") {
		const { width, height } = asset;
		if (!width || !height) throw new ImageAssetInvalidState();
		await database.transaction((tx) =>
			ensureDefaultPresentation(tx, asset.id, input.role, width, height),
		);
		return presentImageAsset(asset);
	}
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
	if (Object.entries(expectedTracking).some(([key, value]) => head.Metadata?.[key] !== value)) {
		await markFailed(asset.id, asset.storageKey);
		throw new ImageAssetContentMismatch();
	}
	const object = await storage.get({ Key: asset.storageKey });
	const bytes = await object.Body?.transformToByteArray();
	const detected = bytes ? await fileTypeFromBuffer(bytes) : undefined;
	if (
		!bytes ||
		!detected ||
		!allowedTypes.has(detected.mime) ||
		detected.mime !== head.ContentType
	) {
		await markFailed(asset.id, asset.storageKey);
		throw new ImageAssetContentMismatch();
	}
	let metadata;
	try {
		metadata = await sharp(bytes, {
			animated: false,
			limitInputPixels: maximumImagePixels,
		}).metadata();
	} catch {
		await markFailed(asset.id, asset.storageKey);
		throw new ImageAssetInvalidSize();
	}
	let width = metadata.width;
	let height = metadata.height;
	if ([5, 6, 7, 8].includes(metadata.orientation ?? 0)) [width, height] = [height, width];
	if (
		!width ||
		!height ||
		!Number.isSafeInteger(width) ||
		!Number.isSafeInteger(height) ||
		width > maximumImageDimension ||
		height > maximumImageDimension ||
		width * height > maximumImagePixels
	) {
		await markFailed(asset.id, asset.storageKey);
		throw new ImageAssetInvalidSize();
	}

	await database.transaction(async (tx) => {
		await tx
			.update(imageObject)
			.set({ mediaType: detected.mime, byteSize: head.ContentLength, width, height })
			.where(eq(imageObject.assetId, asset.id));
		const [ready] = await tx
			.update(imageAsset)
			.set({ status: "ready" })
			.where(and(eq(imageAsset.id, asset.id), eq(imageAsset.status, "pending")))
			.returning({ id: imageAsset.id });
		if (!ready) throw new ImageAssetInvalidState();
		await ensureDefaultPresentation(tx, asset.id, input.role, width, height);
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

export interface ImageAssetPresentationReference {
	readonly assetId: string | null | undefined;
	readonly role: ImageAssetPresentationRole;
}

/** Validate localization images, including their role presentation, in one ownership query. */
export async function ensureImageAssetsAttachable(
	tx: DatabaseTransaction,
	profileId: string,
	references: readonly ImageAssetPresentationReference[],
): Promise<void> {
	const requested = [
		...new Map(
			references.flatMap(({ assetId, role }) =>
				assetId ? [[`${role}:${assetId}`, { assetId, role }] as const] : [],
			),
		).values(),
	];
	if (!requested.length) return;
	const assets = await tx
		.select({ id: imageAsset.id, role: imageAssetPresentation.role })
		.from(imageAsset)
		.innerJoin(imageAssetPresentation, eq(imageAssetPresentation.assetId, imageAsset.id))
		.where(
			and(
				eq(imageAsset.ownerProfileId, profileId),
				eq(imageAsset.status, "ready"),
				isNull(imageAsset.deletedAt),
				or(
					...requested.map(({ assetId, role }) =>
						and(eq(imageAsset.id, assetId), eq(imageAssetPresentation.role, role)),
					),
				),
			),
		);
	if (assets.length !== requested.length) throw new ImageAssetNotFound();
}

export async function upsertImageAssetPresentation(
	profileId: string,
	assetId: string,
	role: ImageAssetPresentationRole,
	input: UpsertImageAssetPresentationBody,
) {
	const asset = await findImageAsset(assetId);
	if (!asset || asset.ownerProfileId !== profileId) throw new ImageAssetNotFound();
	if (asset.status !== "ready" || !asset.width || !asset.height) throw new ImageAssetInvalidState();
	const validated = validateImageAssetPresentation(role, asset.width, asset.height, input);
	const columns = toImageAssetPresentationColumns(validated);
	const [stored] = await database
		.insert(imageAssetPresentation)
		.values({
			assetId,
			role,
			...columns,
		})
		.onConflictDoUpdate({
			target: [imageAssetPresentation.assetId, imageAssetPresentation.role],
			set: {
				...columns,
				revision: sql`${imageAssetPresentation.revision} + 1`,
				updatedAt: new Date(),
			},
			setWhere: sql`
				${imageAssetPresentation.fit} is distinct from ${columns.fit}
				or ${imageAssetPresentation.cropX} is distinct from ${columns.cropX}
				or ${imageAssetPresentation.cropY} is distinct from ${columns.cropY}
				or ${imageAssetPresentation.cropWidth} is distinct from ${columns.cropWidth}
				or ${imageAssetPresentation.cropHeight} is distinct from ${columns.cropHeight}
			`,
		})
		.returning(presentationSelection);
	const effective = stored ?? (await findImageAssetPresentation(assetId, role));
	if (!effective) throw new ImageAssetInvalidPresentation();
	return presentImageAssetPresentation(assetId, effective);
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
