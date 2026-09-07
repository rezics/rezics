import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { imageAsset } from "../database/schema/image";
import { storage } from "../storage";

export type ImageErasureArchive = Pick<
	typeof storage,
	"put" | "listErasurePage" | "deleteErasurePage"
>;

/** Original zero-byte fences reject even in-flight signed conditional PUTs after private bytes are erased. */
export async function erasePrivateImageBatch(
	tx: DatabaseTransaction,
	authUserId: string,
	archive: ImageErasureArchive = storage,
) {
	const predicate = and(
		eq(imageAsset.ownerAuthUserId, authUserId),
		isNull(imageAsset.contentErasedAt),
		or(eq(imageAsset.access, "private"), ne(imageAsset.status, "ready")),
	);
	const [asset] = await tx
		.select()
		.from(imageAsset)
		.where(predicate)
		.limit(1)
		.for("update", { skipLocked: true });
	if (!asset) {
		const [remaining] = await tx
			.select({ id: imageAsset.id })
			.from(imageAsset)
			.where(predicate)
			.limit(1);
		return { deleted: 0, empty: !remaining };
	}
	const prefix = `image-objects/${asset.id}/`;
	const original = `${prefix}original`;
	if (asset.erasureFenceVersionId === null) {
		const fence = await archive.put({
			Key: original,
			Body: new Uint8Array(),
			ContentLength: 0,
			ContentType: "application/octet-stream",
			CacheControl: "private, no-store",
			Metadata: { erased_content: "1" },
		});
		await tx
			.update(imageAsset)
			.set({
				erasureFenceVersionId: fence.VersionId ?? "null",
				deletedAt: asset.deletedAt ?? new Date(),
			})
			.where(eq(imageAsset.id, asset.id));
		return { deleted: 0, empty: false };
	}
	const page = await archive.listErasurePage(prefix);
	if (page.objects.length > 500)
		throw new Error("Object store exceeded the private erasure page bound");
	const objects: { key: string; versionId?: string }[] = [];
	let fenceFound = false;
	for (const object of page.objects) {
		if (!object.key?.startsWith(prefix))
			throw new Error("Object store returned a key outside the admitted image prefix");
		if (object.key === original && (object.versionId ?? "null") === asset.erasureFenceVersionId) {
			if (object.size !== 0) throw new Error("Private upload erasure fence is not empty");
			fenceFound = true;
			continue;
		}
		objects.push({ key: object.key, versionId: object.versionId });
	}
	if (objects.length) {
		await archive.deleteErasurePage(objects);
		return { deleted: objects.length, empty: false };
	}
	if (page.truncated || !fenceFound)
		throw new Error("Private image erasure could not prove its retained empty upload fence");
	await tx
		.update(imageAsset)
		.set({ contentErasedAt: new Date(), deletedAt: asset.deletedAt ?? new Date() })
		.where(and(eq(imageAsset.id, asset.id), sql`${imageAsset.erasureFenceVersionId} is not null`));
	return { deleted: 1, empty: false };
}
