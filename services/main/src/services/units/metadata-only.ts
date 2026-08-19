import { eq } from "drizzle-orm";

import type { Authorization } from "../authorization";
import type { DatabaseTransaction } from "../database";
import { book, media, software } from "../database/schema";
import {
	MetadataOnlyUnitKindValues,
	type MetadataOnlyUnitKind,
} from "../database/schema/contract-values";
import { UnitNotFound } from "./errors";

export function isMetadataOnlyUnitKind(kind: string): kind is MetadataOnlyUnitKind {
	return (MetadataOnlyUnitKindValues as readonly string[]).includes(kind);
}

export function resolveCreatedMetadataOnly(
	ownershipMode: "profile_owned" | "community_owned",
	submitted: boolean | undefined,
): boolean {
	return submitted ?? ownershipMode === "community_owned";
}

export async function getMetadataOnlyInTransaction(
	tx: DatabaseTransaction,
	kind: MetadataOnlyUnitKind,
	unitId: string,
): Promise<boolean> {
	if (kind === "book") {
		const [row] = await tx
			.select({ metadataOnly: book.metadataOnly })
			.from(book)
			.where(eq(book.id, unitId))
			.limit(1);
		if (!row) throw new UnitNotFound(kind);
		return row.metadataOnly;
	}
	if (kind === "software") {
		const [row] = await tx
			.select({ metadataOnly: software.metadataOnly })
			.from(software)
			.where(eq(software.id, unitId))
			.limit(1);
		if (!row) throw new UnitNotFound(kind);
		return row.metadataOnly;
	}
	const [row] = await tx
		.select({ metadataOnly: media.metadataOnly })
		.from(media)
		.where(eq(media.id, unitId))
		.limit(1);
	if (!row) throw new UnitNotFound(kind);
	return row.metadataOnly;
}

/** Enforces the supplemental permission only when the persisted value changes. */
export async function ensureMetadataOnlyChangeAllowed(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	kind: MetadataOnlyUnitKind,
	unitId: string,
	next: boolean,
): Promise<void> {
	const current = await getMetadataOnlyInTransaction(tx, kind, unitId);
	if (current !== next)
		await authorization.unit.ensureInTransaction(tx, unitId, "unit.metadata-only.update", ["unit"]);
}
