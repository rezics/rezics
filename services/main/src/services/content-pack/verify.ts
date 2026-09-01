import { inArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { collectionStructureRevisionHead, unit } from "../database/schema";
import { assertContentPackDocuments } from "./documents";
import { ContentPackInvalid } from "./errors";
import type { LoadedPack } from "./contracts";
import { assertContentPackThemeAssets } from "./theme-assets";

export async function verifyContentPack(
	tx: DatabaseTransaction,
	pack: LoadedPack,
): Promise<{ readonly ok: true; readonly present: number }> {
	assertContentPackDocuments(pack);
	await assertContentPackThemeAssets(tx, pack);
	const unitIds = pack.objects.map((object) => pack.ids.units[object.sourceKey]!);
	const existing = await tx.select({ id: unit.id }).from(unit).where(inArray(unit.id, unitIds));
	if (existing.length !== unitIds.length)
		throw new ContentPackInvalid(
			`${pack.manifest.id} is missing ${unitIds.length - existing.length} imported units`,
		);
	const collectionIds = pack.objects.flatMap((object) =>
		object.unit.kind === "collection" ? [pack.ids.units[object.sourceKey]!] : [],
	);
	const collectionStructureHeads = collectionIds.length
		? await tx
				.select({ collectionId: collectionStructureRevisionHead.collectionId })
				.from(collectionStructureRevisionHead)
				.where(inArray(collectionStructureRevisionHead.collectionId, collectionIds))
		: [];
	if (collectionStructureHeads.length !== collectionIds.length)
		throw new ContentPackInvalid(
			`${pack.manifest.id} is missing ${collectionIds.length - collectionStructureHeads.length} imported Collection Structure revision heads`,
		);
	return { ok: true, present: existing.length };
}
