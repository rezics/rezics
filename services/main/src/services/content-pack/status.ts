import type { DatabaseTransaction } from "../database";
import { readPackIdentities } from "./identity";
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
		const existing = await readPackIdentities(tx, pack);
		result.push({
			packId: pack.manifest.id,
			version: pack.manifest.version,
			present: existing.length,
			total: unitIds.length,
		});
	}
	return result;
}
