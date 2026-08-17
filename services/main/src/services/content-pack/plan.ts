import { inArray } from "drizzle-orm";

import { BootstrapUnitIds } from "../bootstrap/data";
import type { DatabaseTransaction } from "../database";
import { unit } from "../database/schema";
import { ContentPackCollision, ContentPackInvalid } from "./errors";
import type { ContentPackPlan, LoadedPack, PlannedObject } from "./contracts";

const BootstrapIdSet = new Set<string>(BootstrapUnitIds);

export async function planContentPack(
	tx: DatabaseTransaction,
	pack: LoadedPack,
	sourceRoot: string,
): Promise<ContentPackPlan> {
	const unitIds = Object.values(pack.ids.units);
	for (const [sourceKey, unitId] of Object.entries(pack.ids.units)) {
		if (BootstrapIdSet.has(unitId))
			throw new ContentPackCollision(`${sourceKey} uses Bootstrap ID ${unitId}`);
	}
	for (const object of pack.objects) {
		if (!pack.ids.units[object.sourceKey])
			throw new ContentPackInvalid(`Missing unit id for ${object.sourceKey}`);
	}

	const existingUnits = unitIds.length
		? await tx.select({ id: unit.id }).from(unit).where(inArray(unit.id, unitIds))
		: [];
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
	if (createCount > 0 && noopCount > 0) {
		const conflicts = planned
			.filter((item) => item.action === "create")
			.map((item) => ({
				...item,
				action: "conflict" as const,
				reason: "pack is only partially present; reset the database before applying again",
			}));
		return {
			packId: pack.manifest.id,
			version: pack.manifest.version,
			checksum: pack.checksum,
			sourceRoot,
			alreadyInstalled: false,
			objects: planned,
			createCount,
			noopCount,
			conflicts,
		};
	}

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
