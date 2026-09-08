import { catalogSourcePath } from "./source-document-scope";
import { and, eq, isNull, ne, or, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { CatalogNameTables } from "../database/schema/catalog-names";
import type { CatalogReference } from "./contracts";
import {
	addCatalogIdentifier,
	bindCatalogIdentifierSourceOccurrence,
	reviseCatalogIdentifier,
} from "./identifiers";
import { normalizeCatalogIdentifier } from "./name-contracts";
import { catalogIdentifierRevisionValues } from "./source-owned-compensation";
import { resolveCatalogSourceOwnedBaseline } from "./source-owned-baselines";
import { catalogSourceSupportColumns } from "./source-support";
import type { CatalogSourceNativeChange } from "./source-applications";

const descriptorSchema = z.strictObject({
	namespace: z.string().min(1).max(256),
	value: z.string().min(1).max(8192),
	path: z.string().startsWith("/").max(512),
});
export type CatalogSourceIdentifierDescriptor = z.infer<typeof descriptorSchema>;

/** @internal Identifier evidence is an immutable claim revision; additions/removals never overwrite unrelated claims. */
export async function applyCatalogSourceIdentifierDelta(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	source: {
		sourceRecordId: string;
		mappingKey: string;
		previousSnapshotId: string;
		snapshotId: string;
	},
	previousInput: readonly CatalogSourceIdentifierDescriptor[],
	incomingInput: readonly CatalogSourceIdentifierDescriptor[],
) {
	const previous = z.array(descriptorSchema).max(128).parse(previousInput.map((entry) => ({ ...entry, path: catalogSourcePath(source.sourceRecordId, source.previousSnapshotId, entry.path) }))),
		incoming = z.array(descriptorSchema).max(128).parse(incomingInput.map((entry) => ({ ...entry, path: catalogSourcePath(source.sourceRecordId, source.snapshotId, entry.path) })));
	if (previous.length + incoming.length > 128)
		throw new RangeError("Identifier delta requires staged source application");
	const f = CatalogFactTables[reference.owner],
		t = CatalogNameTables[reference.owner];
	const scope = await catalogSourceSupportColumns(tx, source.sourceRecordId);
	const identity = (entry: CatalogSourceIdentifierDescriptor) => {
		const value = normalizeCatalogIdentifier({ namespace: entry.namespace, value: entry.value });
		return JSON.stringify([value.namespace, value.normalizedValue]);
	};
	const unique = (entries: readonly CatalogSourceIdentifierDescriptor[]) => {
		const result = new Map<string, CatalogSourceIdentifierDescriptor>();
		for (const entry of entries)
			if (!result.has(identity(entry))) result.set(identity(entry), entry);
		return result;
	};
	const before = unique(previous),
		after = unique(incoming);
	const changes: CatalogSourceNativeChange[] = [];
	const locate = async (snapshotId: string, entry: CatalogSourceIdentifierDescriptor) => {
		const rows = await tx
			.select(getTableColumns(t.identifierRevision))
			.from(f.support)
			.innerJoin(
				t.identifierRevision,
				and(
					eq(t.identifierRevision.ownerId, f.support.ownerId),
					eq(t.identifierRevision.id, f.support.identifierId),
					eq(t.identifierRevision.revision, f.support.identifierRevision),
				),
			)
			.where(
				and(
					eq(f.support.ownerId, reference.id),
					eq(f.support.sourceRecordId, source.sourceRecordId),
					eq(f.support.sourceMappingKey, scope.sourceMappingKey),
					eq(f.support.sourceCorrespondenceRevision, scope.sourceCorrespondenceRevision),
					eq(f.support.snapshotId, snapshotId),
					eq(f.support.sourcePath, entry.path),
				),
			)
			.limit(2);
		if (rows.length > 1) throw new TypeError("Identifier source occurrence is ambiguous");
		const row = rows[0];
		const expected = normalizeCatalogIdentifier({ namespace: entry.namespace, value: entry.value });
		if (
			row &&
			(row.namespace !== expected.namespace ||
				row.normalizedValue !== expected.normalizedValue ||
				row.state !== "active")
		)
			throw new TypeError("Identifier occurrence differs from its immutable source claim");
		return row;
	};
	const baseline = (claim: NonNullable<Awaited<ReturnType<typeof locate>>>) =>
		resolveCatalogSourceOwnedBaseline(
			tx,
			{ sourceRecordId: source.sourceRecordId, mappingKey: source.mappingKey },
			{
				kind: "catalog-identifier",
				owner: reference.owner,
				ownerId: reference.id,
				componentKey: claim.id,
			},
			claim.revision,
		);
	for (const [key, entry] of after) {
		const old = before.get(key);
		const origin = old ? await locate(source.previousSnapshotId, old) : undefined;
		if (old && !origin) throw new TypeError("Previous identifier source occurrence is missing");
		let identifierId: string, identifierRevision: number;
		if (origin) {
			identifierId = origin.id;
			identifierRevision = origin.revision;
		} else {
			const recovered = await locate(source.snapshotId, entry);
			if (recovered) {
				const expected = await baseline(recovered);
				const restored = await reviseCatalogIdentifier(
					tx,
					reference,
					actor,
					recovered.id,
					expected,
					catalogIdentifierRevisionValues(recovered),
				);
				identifierId = restored.id;
				identifierRevision = recovered.revision;
				changes.push({
					kind: "catalog-identifier",
					owner: reference.owner,
					ownerId: reference.id,
					componentKey: restored.id,
					beforeRevision: expected,
					afterRevision: restored.revision,
				});
			} else {
				const created = await addCatalogIdentifier(tx, reference, actor, revision, {
					namespace: entry.namespace,
					value: entry.value,
				});
				revision = created.revision;
				identifierId = created.id;
				identifierRevision = created.identifierRevision;
				changes.push({
					kind: "catalog-identifier",
					owner: reference.owner,
					ownerId: reference.id,
					componentKey: created.id,
					beforeRevision: null,
					afterRevision: created.identifierRevision,
				});
			}
		}
		await bindCatalogIdentifierSourceOccurrence(tx, reference, actor, {
			sourceRecordId: source.sourceRecordId,
			snapshotId: source.snapshotId,
			sourcePath: entry.path,
			identifierId,
			identifierRevision,
		});
	}
	for (const [key, entry] of before) {
		if (after.has(key)) continue;
		const claim = await locate(source.previousSnapshotId, entry);
		if (!claim) throw new TypeError("Removed identifier source occurrence is missing");
		const [independent] = await tx
			.select({ id: f.support.id })
			.from(f.support)
			.where(
				and(
					eq(f.support.ownerId, reference.id),
					eq(f.support.identifierId, claim.id),
					or(
						ne(f.support.sourceRecordId, source.sourceRecordId),
						isNull(f.support.sourceMappingKey),
					),
					isNull(f.support.withdrawnAt),
				),
			)
			.limit(1);
		if (independent) continue;
		const expected = await baseline(claim);
		const retired = await reviseCatalogIdentifier(tx, reference, actor, claim.id, expected, {
			...catalogIdentifierRevisionValues(claim),
			state: "withdrawn",
		});
		changes.push({
			kind: "catalog-identifier",
			owner: reference.owner,
			ownerId: reference.id,
			componentKey: claim.id,
			beforeRevision: expected,
			afterRevision: retired.revision,
		});
	}
	return { revision, changes };
}
