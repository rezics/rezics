import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { catalogSourceMappingClaim } from "../database/schema/catalog-source";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogOwner } from "./contracts";
import { addCatalogName, createCatalogIdentity, loadCatalogIdentity } from "./storage";
import {
	type CatalogSourceReferenceEvidence,
	requireCatalogSourceReferenceEvidence,
	registerCatalogSourceRecord,
} from "./source-observations";

/** A provider reference can identify an object before its own endpoint is fetched. */
export async function bindReferencedSourceIdentity(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		readonly source: string;
		readonly objectType: string;
		readonly externalId: string;
		readonly owner: CatalogOwner;
		readonly shape: string;
		readonly name?: string;
		readonly evidence: CatalogSourceReferenceEvidence;
	},
) {
	const evidence = requireCatalogSourceReferenceEvidence(input.evidence);
	if (evidence.source !== input.source || evidence.externalId !== input.externalId)
		throw new TypeError("Source reference identity differs from its recorded evidence");
	const record = await registerCatalogSourceRecord(tx, {
		source: input.source,
		objectType: input.objectType,
		externalId: input.externalId,
	});
	const [claim] = await tx
		.select()
		.from(catalogSourceMappingClaim)
		.where(
			and(
				eq(catalogSourceMappingClaim.sourceRecordId, record.id),
				eq(catalogSourceMappingClaim.path, "/"),
			),
		)
		.limit(1);
	if (claim) {
		if (claim.owner !== input.owner)
			throw new Error("Source reference resolves to another storage owner; review is required");
		const binding = CatalogFactTables[claim.owner].sourceBinding;
		const [target] = await tx
			.select()
			.from(binding)
			.where(and(eq(binding.sourceRecordId, record.id), eq(binding.mappingKey, claim.mappingKey)))
			.limit(1);
		if (!target) throw new Error("Referenced source mapping has no native target");
		const reference = { owner: claim.owner, id: target.ownerId };
		const identity = await loadCatalogIdentity(tx, reference, actor, false);
		if (identity.shape !== input.shape && input.shape !== "unresolved")
			throw new Error("Referenced source grain differs; review is required");
		return { ...reference, revision: identity.revision, created: false };
	}
	const identity = await createCatalogIdentity(
		tx,
		{ owner: input.owner, shape: input.shape },
		actor,
	);
	let revision = identity.revision;
	if (input.name)
		revision = (
			await addCatalogName(tx, identity, actor, revision, {
				kind: "source-reference",
				languageTag: null,
				value: input.name,
			})
		).revision;
	const tables = CatalogFactTables[input.owner];
	const [identifier] = await tx
		.insert(tables.identifier)
		.values({
			ownerId: identity.id,
			namespace: `${input.source}.${input.objectType}`,
			value: input.externalId,
			normalizedValue: input.externalId,
		})
		.returning({ id: tables.identifier.id });
	if (!identifier) throw new Error("Referenced source identifier insertion returned no row");
	await tx.insert(tables.support).values({
		ownerId: identity.id,
		identifierId: identifier.id,
		sourceRecordId: evidence.sourceRecordId,
		snapshotId: evidence.snapshotId,
		sourcePath: evidence.path,
	});
	const [createdClaim] = await tx
		.insert(catalogSourceMappingClaim)
		.values({
			sourceRecordId: record.id,
			path: "/",
			owner: input.owner,
			observedSnapshotId: null,
			baselineTargetRevision: revision,
			evidenceSourceRecordId: evidence.sourceRecordId,
			evidenceSnapshotId: evidence.snapshotId,
			evidencePath: evidence.path,
		})
		.returning();
	if (!createdClaim) throw new Error("Referenced source mapping claim insertion returned no row");
	await tx.insert(tables.sourceBinding).values({
		ownerId: identity.id,
		mappingOwner: input.owner,
		mappingKey: createdClaim.mappingKey,
		sourceRecordId: record.id,
	});
	return { owner: input.owner, id: identity.id, revision, created: true };
}
