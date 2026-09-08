import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { isSlugLabel } from "@rezics/slug";
import type { DatabaseTransaction } from "../database";
import { unitSlugAddress } from "../database/schema";
import { UnitGovernanceLookupInvalid } from "../api/governance/errors";
export type GovernanceLookupInput = {
	readonly query?: string;
	readonly scopeNamespaceId?: string;
	readonly scopeUnitId?: string;
};
/** Exact unique address lookup; this administration surface does not offer corpus title search. */
export async function resolveGovernanceLookup(
	tx: DatabaseTransaction,
	input: GovernanceLookupInput,
): Promise<{ kind: "browse" } | { kind: "exact"; id: string | null }> {
	const query = input.query?.trim();
	const scopes = Number(Boolean(input.scopeNamespaceId)) + Number(Boolean(input.scopeUnitId));
	if (!query) {
		if (scopes) throw new UnitGovernanceLookupInvalid();
		return { kind: "browse" };
	}
	const id = z.uuid().safeParse(query);
	if (id.success) {
		if (scopes) throw new UnitGovernanceLookupInvalid();
		return { kind: "exact", id: id.data };
	}
	if (!isSlugLabel(query) || scopes !== 1) throw new UnitGovernanceLookupInvalid();
	const namespace = input.scopeNamespaceId ? z.uuid().safeParse(input.scopeNamespaceId) : null;
	const unitScope = input.scopeUnitId ? z.uuid().safeParse(input.scopeUnitId) : null;
	if (namespace?.success === false || unitScope?.success === false)
		throw new UnitGovernanceLookupInvalid();
	const [address] = await tx
		.select({ id: unitSlugAddress.targetUnitId })
		.from(unitSlugAddress)
		.where(
			and(
				eq(unitSlugAddress.slug, query),
				namespace?.success
					? eq(unitSlugAddress.scopeNamespaceId, namespace.data)
					: isNull(unitSlugAddress.scopeNamespaceId),
				unitScope?.success
					? eq(unitSlugAddress.scopeUnitId, unitScope.data)
					: isNull(unitSlugAddress.scopeUnitId),
			),
		)
		.limit(1);
	return { kind: "exact", id: address?.id ?? null };
}
