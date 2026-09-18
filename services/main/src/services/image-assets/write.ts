import { eq } from "drizzle-orm";
import { database, type DatabaseTransaction } from "../database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { imageAsset } from "@rezics/schema/postgres/media/image";
import { ImageAssetNotFound } from "../api/image-assets/errors";

/** One database connection locks account then asset across its bounded object-store effect. */
export function withImageAssetWrite<T>(
	authUserId: string,
	assetId: string,
	work: (tx: DatabaseTransaction) => Promise<T>,
	allowPublishedPublic = false,
): Promise<T> {
	return database.transaction(async (tx) => {
		const [account] = await tx
			.select({ erasedAt: users.erasedAt })
			.from(users)
			.where(eq(users.id, authUserId))
			.limit(1)
			.for("share");
		const [asset] = await tx
			.select()
			.from(imageAsset)
			.where(eq(imageAsset.id, assetId))
			.limit(1)
			.for("update");
		if (
			!account ||
			!asset ||
			asset.ownerAuthUserId !== authUserId ||
			asset.deletedAt ||
			(account.erasedAt &&
				!(allowPublishedPublic && asset.access === "public" && asset.status === "ready"))
		)
			throw new ImageAssetNotFound();
		return work(tx);
	});
}
