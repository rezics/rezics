import { cachedMusicBrainzRecording } from "./musicbrainz-reference-cache";
import { catalogReferenceAwareSupportColumns } from "./source-support";
import { withCatalogReferenceInitialization } from "./reference-initialization";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { catalogSourceMappingClaim, catalogSourceRecord } from "../database/schema/catalog-source";
import { catalogSourceRecordId } from "./source-record-key";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { CatalogReferenceSchema, type CatalogOwner, type CatalogReference } from "./contracts";
import { addCatalogName, createCatalogIdentity, loadCatalogIdentity } from "./storage";
import { sealInitialCatalogSourceBinding } from "./source-bindings";
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
		/** Proposal callbacks resolve prepared correspondences without creating or editing foreign owners. */
		readonly mode?: "intake" | "prepared";
		/** Initial owner state must be completed before sealing the pristine-source baseline. */
		readonly initialize?: (
			reference: Readonly<CatalogReference & { revision: number }>,
		) => Promise<CatalogReference & { revision: number }>;
	},
) {
	const evidence = requireCatalogSourceReferenceEvidence(input.evidence);
	if (evidence.source !== input.source || evidence.externalId !== input.externalId)
		throw new TypeError("Source reference identity differs from its recorded evidence");
	const cached = cachedMusicBrainzRecording(tx, actor, input);
	if (cached) return cached;
	const key = {
		source: input.source,
		objectType: input.objectType,
		externalId: input.externalId,
	};
	// Existing popular artists/terms share the correspondence lock; only initial admission needs exclusive ownership.
	const [known] = await tx
		.select({ record: catalogSourceRecord })
		.from(catalogSourceRecord)
		.innerJoin(
			catalogSourceMappingClaim,
			and(
				eq(catalogSourceMappingClaim.sourceRecordId, catalogSourceRecord.id),
				eq(catalogSourceMappingClaim.path, "/"),
			),
		)
		.where(eq(catalogSourceRecord.id, catalogSourceRecordId(key)))
		.limit(1)
		.for("share");
	if (!known && input.mode === "prepared")
		throw new Error(
			`Source dependency requires separately authorized intake: ${key.source}/${key.objectType}/${key.externalId}`,
		);
	const record = known?.record ?? (await registerCatalogSourceRecord(tx, key));
	if (
		record.source !== key.source ||
		record.objectType !== key.objectType ||
		record.externalId !== key.externalId
	)
		throw new TypeError("Referenced source natural identity differs from its registered record");
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
	return withCatalogReferenceInitialization({tx,reference:identity,evidenceSourceRecordId:evidence.sourceRecordId},async()=>{
	let revision = identity.revision;
	if (input.name)
		revision = (
			await addCatalogName(tx, identity, actor, revision, {
				kind: "source-reference",
				languageTag: null,
				value: input.name,
			})
		).revision;
	if (input.initialize) {
		const initialized = await input.initialize(
			Object.freeze({ owner: identity.owner, id: identity.id, revision }),
		);
		const returned = CatalogReferenceSchema.parse({ owner: initialized.owner, id: initialized.id });
		if (returned.owner !== identity.owner || returned.id !== identity.id)
			throw new TypeError("Source initializer returned another native identity");
		z.number().int().min(revision).max(Number.MAX_SAFE_INTEGER).parse(initialized.revision);
		const current = await loadCatalogIdentity(tx, identity, actor, true);
		if (current.revision !== initialized.revision)
			throw new TypeError("Source initializer did not commit its declared native revision");
		revision = initialized.revision;
	}
	const tables = CatalogFactTables[input.owner];
	const [identifier] = await tx
		.insert(tables.identifier)
		.values({
			ownerId: identity.id,
			namespace: `${input.source}.${input.objectType}`,
			value: input.externalId,
			normalizedValue: input.externalId,
		})
		.returning({ id: tables.identifier.id, identifierRevision: tables.identifier.revision });
	if (!identifier) throw new Error("Referenced source identifier insertion returned no row");
	await tx.insert(tables.support).values({
		...(await catalogReferenceAwareSupportColumns(tx, evidence.sourceRecordId)),
		ownerId: identity.id,
		identifierId: identifier.id,
		identifierRevision: identifier.identifierRevision,
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
			mappingVersion: `${input.source}.${input.objectType}.1`,
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
	await sealInitialCatalogSourceBinding(tx, actor, {
		sourceRecordId: record.id,
		mappingKey: createdClaim.mappingKey,
	});
	return { owner: input.owner, id: identity.id, revision, created: true };
	});
}
