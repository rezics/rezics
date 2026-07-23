import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { BlockReferenceResolver } from "@rezics/block";

import { getUnitReadCondition } from "../authorization/unit/query";
import type { DatabaseTransaction } from "../database";
import { imageAsset, post, contentStructure, unit, type UnitKind } from "../database/schema";

export interface UnitBlockReferenceHost {
	readonly unitId: string;
	readonly kind: UnitKind;
}

export function createUnitBlockReferenceResolver(
	tx: DatabaseTransaction,
	input: {
		readonly host: UnitBlockReferenceHost;
		readonly profileId: string;
	},
): BlockReferenceResolver {
	return {
		async resolve(kind, identifiers) {
			if (!identifiers.length) return new Set<string>();
			if (kind === "unit") {
				const rows = await tx
					.select({ id: unit.id })
					.from(unit)
					.where(
						and(
							inArray(unit.id, [...identifiers]),
							getUnitReadCondition(input.profileId),
						),
					);
				return new Set(rows.map((row) => row.id));
			}
			if (kind === "wiki-post") {
				const rows = await tx
					.select({ id: post.id })
					.from(post)
					.innerJoin(unit, eq(unit.id, post.id))
					.where(
						and(
							inArray(post.id, [...identifiers]),
							eq(post.kind, "wiki"),
							getUnitReadCondition(input.profileId),
						),
					);
				return new Set(rows.map((row) => row.id));
			}
			if (kind === "asset") {
				const rows = await tx
					.select({ id: imageAsset.id })
					.from(imageAsset)
					.where(
						and(
							inArray(imageAsset.id, [...identifiers]),
							eq(imageAsset.status, "ready"),
							isNull(imageAsset.deletedAt),
							or(
								eq(imageAsset.access, "public"),
								eq(imageAsset.ownerProfileId, input.profileId),
							),
						),
					);
				return new Set(rows.map((row) => row.id));
			}
			if (kind === "navigation") {
				const structureKind =
					input.host.kind === "zone"
						? "zone.navigation"
						: input.host.kind === "realm"
							? "realm.navigation"
							: null;
				if (!structureKind) return new Set<string>();
				const rows = await tx
					.select({ id: contentStructure.id })
					.from(contentStructure)
					.where(
						and(
							eq(contentStructure.ownerUnitId, input.host.unitId),
							eq(contentStructure.kind, structureKind),
							inArray(contentStructure.id, [...identifiers]),
							isNull(contentStructure.deletedAt),
						),
					);
				return new Set(rows.map((row) => row.id));
			}
			return new Set<string>();
		},
	};
}

export function unitBlockGraphLockName(host: UnitBlockReferenceHost): string {
	if (host.kind === "zone") return `zone-graph:${host.unitId}`;
	if (host.kind === "realm") return `realm-graph:${host.unitId}`;
	return `unit-graph:${host.unitId}`;
}
