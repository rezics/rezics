import { inArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { unit } from "../database/schema";
import { ContentPackInvalid } from "./errors";
import type { LoadedPack } from "./contracts";

export async function verifyContentPack(
	tx: DatabaseTransaction,
	pack: LoadedPack,
): Promise<{ readonly ok: true; readonly present: number }> {
	const unitIds = pack.objects.map((object) => pack.ids.units[object.sourceKey]!);
	const existing = await tx.select({ id: unit.id }).from(unit).where(inArray(unit.id, unitIds));
	if (existing.length !== unitIds.length)
		throw new ContentPackInvalid(
			`${pack.manifest.id} is missing ${unitIds.length - existing.length} imported units`,
		);
	return { ok: true, present: existing.length };
}
