import { selfAuthUserIdForEntity } from "../participation/account-query";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { BlockReferenceResolver } from "@rezics/block";

import { Authorization } from "../authorization";
import type { UnitAuthorization } from "../authorization/unit/authorization";
import { currentParticipationAuthority } from "../participation/policy";
import type { UnitOwner } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { imageAsset, post, label, contentStructure, authEntity } from "../database/schema";

export interface UnitBlockReferenceHost {
	readonly unitId: string;
	readonly kind: UnitOwner;
}

export function createUnitBlockReferenceResolver(
	tx: DatabaseTransaction,
	input: {
		readonly host: UnitBlockReferenceHost;
		readonly profileId: string;
		readonly authorization?: UnitAuthorization<string>;
	},
): BlockReferenceResolver {
	return {
		async resolve(kind, identifiers) {
			if (!identifiers.length) return new Set<string>();
			if (kind === "label" || kind === "unit" || kind === "wiki-post") {
				const selected = [...new Set(identifiers)];
				if (selected.length > 500)
					throw new RangeError("Block reference batches cannot exceed 500 targets");
				const [binding] = input.authorization
					? []
					: await tx
							.select({ authUserId: authEntity.authUserId })
							.from(authEntity)
							.where(and(eq(authEntity.entityId, input.profileId), eq(authEntity.state, "active")))
							.limit(1);
				const authorization =
					input.authorization ??
					new Authorization(input.profileId, binding?.authUserId, currentParticipationAuthority())
						.unit;
				const readable = await authorization.readableUnitIdsInTransaction(tx, selected);
				if (kind === "unit" || !readable.size) return readable;
				const table = kind === "label" ? label : post;
				const rows = await tx
					.select({ id: table.id })
					.from(table)
					.where(
						and(
							inArray(table.id, [...readable]),
							kind === "wiki-post" ? eq(post.kind, "wiki") : undefined,
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
								eq(imageAsset.ownerAuthUserId, selfAuthUserIdForEntity(input.profileId)),
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
							? "wiki.navigation"
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
