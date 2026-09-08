import { BootstrapUnitIds } from "../bootstrap/data";
import type { DatabaseTransaction } from "../database";
import type { ContentPackPlan, LoadedPack, PlannedObject } from "./contracts";
import { ContentPackCollision, ContentPackInvalid } from "./errors";
import { readPackIdentities } from "./identity";

const BootstrapIdSet = new Set<string>(BootstrapUnitIds);

export async function planContentPack(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	sourceRoot: string,
): Promise<ContentPackPlan> {
	for (const [sourceKey, unitId] of Object.entries(pack.ids.units)) {
		if (BootstrapIdSet.has(unitId))
			throw new ContentPackCollision(`${sourceKey} uses Bootstrap ID ${unitId}`);
	}
	for (const object of pack.objects) {
		if (!pack.ids.units[object.sourceKey])
			throw new ContentPackInvalid(`Missing unit id for ${object.sourceKey}`);
	}

	const existingUnits = await readPackIdentities(tx, pack);

	const existingIds = new Set(existingUnits.map((row) => row.id));
	const planned: PlannedObject[] = [];
	for (const object of pack.objects) {
		const unitId = pack.ids.units[object.sourceKey]!;
		if (existingIds.has(unitId)) {
			planned.push({ sourceKey: object.sourceKey, unitId, action: "noop" });
			continue;
		}
		planned.push({ sourceKey: object.sourceKey, unitId, action: "create" });
	}

	const createCount = planned.filter((item) => item.action === "create").length;
	const noopCount = planned.filter((item) => item.action === "noop").length;

	return {
		packId: pack.manifest.id,
		version: pack.manifest.version,
		checksum: pack.checksum,
		sourceRoot,
		alreadyInstalled: createCount === 0,
		objects: planned,
		createCount,
		noopCount,
		conflicts: [],
	};
}
