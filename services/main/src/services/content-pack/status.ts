import { inArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { unit } from "../database/schema";
import type { LoadedPack } from "./contracts";

export async function listContentPackStatus(
	tx: DatabaseTransaction,
	packs: readonly LoadedPack[],
): Promise<
	readonly {
		readonly packId: string;
		readonly version: string;
		readonly present: number;
		readonly total: number;
	}[]
> {
	const result = [];
	for (const pack of packs) {
		const unitIds = Object.values(pack.ids.units);
		const existing = unitIds.length
			? await tx.select({ id: unit.id }).from(unit).where(inArray(unit.id, unitIds))
			: [];
		result.push({
			packId: pack.manifest.id,
			version: pack.manifest.version,
			present: existing.length,
			total: unitIds.length,
		});
	}
	return result;
}
