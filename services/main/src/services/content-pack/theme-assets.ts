import type { DatabaseTransaction } from "../database";
import { findPublicZoneThemeHeroAssets } from "../api/image-assets/service";
import type { LoadedPack } from "./contracts";
import { ContentPackInvalid } from "./errors";

/** Validate every persisted Zone hero in one indexed image-asset lookup. */
export async function assertContentPackThemeAssets(
	tx: DatabaseTransaction,
	pack: LoadedPack,
): Promise<void> {
	const references = pack.objects.flatMap((object) => {
		const assetId = object.compiledZone?.themeDocument.heroAssetId;
		return object.unit.kind === "zone" && assetId ? [{ sourceKey: object.sourceKey, assetId }] : [];
	});
	if (!references.length) return;
	const resolved = await findPublicZoneThemeHeroAssets(
		tx,
		references.map(({ assetId }) => assetId),
	);
	const invalid = references.find(({ assetId }) => !resolved.has(assetId));
	if (invalid)
		throw new ContentPackInvalid(
			`${invalid.sourceKey} Zone theme hero must reference a ready, public image with a banner presentation`,
		);
}
