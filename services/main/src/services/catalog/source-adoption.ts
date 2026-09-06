import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import {
	catalogSourceAdoptionProposal,
	catalogSourceMappingClaim,
	catalogSourceSnapshot,
} from "../database/schema/catalog-source";
import { programWork } from "../database/schema/catalog-program";
import { softwareContent } from "../database/schema/catalog-software";
import { type CatalogOwner, type CatalogValueKind } from "./contracts";
import {
	BangumiSubjectContractSha256,
	BangumiSubjectSchema,
	planBangumiSubject,
	type BangumiSubject,
} from "./bangumi";
import { type CatalogSourceReceipt, recordCatalogSourceObservation } from "./source-observations";
import {
	addCatalogName,
	appendCatalogFactNodes,
	beginCatalogFact,
	createCatalogIdentity,
	ensureCatalogDefinition,
	loadCatalogIdentity,
	sealCatalogFact,
} from "./storage";
import { assignGroupingClass } from "./grouping";
import { catalogValueNodes } from "./value-nodes";

const bangumiValueKinds = {
	id: "number",
	type: "number",
	name: "string",
	name_cn: "string",
	summary: "string",
	series: "boolean",
	nsfw: "boolean",
	locked: "boolean",
	date: "string",
	platform: "string",
	images: "object",
	infobox: "array",
	volumes: "number",
	eps: "number",
	total_episodes: "number",
	rating: "object",
	collection: "object",
	tags: "array",
	meta_tags: "array",
} as const satisfies Record<keyof BangumiSubject, CatalogValueKind>;

async function findBoundIdentity(tx: DatabaseTransaction, sourceRecordId: string) {
	const [claim] = await tx
		.select()
		.from(catalogSourceMappingClaim)
		.where(
			and(
				eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId),
				eq(catalogSourceMappingClaim.path, "/"),
			),
		)
		.limit(1)
		.for("update");
	if (!claim) return null;
	const bindingTable = CatalogFactTables[claim.owner].sourceBinding;
	const [binding] = await tx
		.select()
		.from(bindingTable)
		.where(eq(bindingTable.mappingKey, claim.mappingKey))
		.limit(1);
	if (!binding) throw new Error("Source mapping claim has no native binding");
	const identityTable = CatalogIdentityTables[claim.owner];
	const [identity] = await tx
		.select()
		.from(identityTable)
		.where(eq(identityTable.id, binding.ownerId))
		.limit(1);
	if (!identity) throw new Error("Source binding target is missing");
	return { claim, identity, reference: { owner: claim.owner, id: identity.id } };
}

export async function inspectExistingSourceBinding(
	tx: DatabaseTransaction,
	actor: string,
	observation: Awaited<ReturnType<typeof recordCatalogSourceObservation>>,
	mappingVersion: string,
) {
	const bound = await findBoundIdentity(tx, observation.record.id);
	if (bound) {
		await loadCatalogIdentity(tx, bound.reference, actor, false);
		const [acceptedSnapshot] =
			bound.claim.observedSnapshotId === null
				? []
				: await tx
						.select()
						.from(catalogSourceSnapshot)
						.where(
							and(
								eq(catalogSourceSnapshot.sourceRecordId, observation.record.id),
								eq(catalogSourceSnapshot.id, bound.claim.observedSnapshotId),
							),
						)
						.limit(1);
		if (
			acceptedSnapshot?.contentSha256 === observation.snapshot.contentSha256 &&
			acceptedSnapshot.contractSha256 === observation.snapshot.contractSha256
		)
			return {
				status: "unchanged" as const,
				reference: bound.reference,
				revision: bound.identity.revision,
				snapshotId: acceptedSnapshot.id,
				observedSnapshotId: observation.snapshot.id,
			};
		await tx
			.insert(catalogSourceAdoptionProposal)
			.values({
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				mappingKey: bound.claim.mappingKey,
				mappingOwner: bound.claim.owner,
				mappingVersion,
				proposerAuthUserId: actor,
				expectedTargetRevision: bound.identity.revision,
			})
			.onConflictDoNothing();
		return {
			status: "review_required" as const,
			reference: bound.reference,
			revision: bound.identity.revision,
			snapshotId: observation.snapshot.id,
		};
	}
	return null;
}

/** Initial source adoption is private. Changed snapshots queue review instead of overwriting edits. */
export async function adoptBangumiSubject(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new Error("Bangumi projection bytes differ from the archived observation");
	if (receipt.contractSha256 !== BangumiSubjectContractSha256)
		throw new Error("Bangumi source contract has not been reviewed for this mapper");
	const plan = planBangumiSubject(
		JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	);
	if (
		receipt.key.source !== "bangumi" ||
		receipt.key.objectType !== "subject" ||
		receipt.key.externalId !== String(plan.subject.id)
	)
		throw new TypeError("Bangumi payload identity differs from its archived source record");
	const observation = await recordCatalogSourceObservation(tx, receipt);
	const existing = await inspectExistingSourceBinding(tx, actor, observation, "bangumi.subject.1");
	if (existing) return existing;
	const identity = await createCatalogIdentity(
		tx,
		{ owner: plan.owner, shape: plan.shape, contentRating: plan.contentRating },
		actor,
	);
	if (plan.owner === "program")
		await tx.insert(programWork).values({
			id: identity.id,
			declaredMainEpisodeCount: plan.subject.eps,
			declaredTotalEpisodeCount: plan.subject.total_episodes,
		});
	if (plan.owner === "software") await tx.insert(softwareContent).values({ id: identity.id });
	let revision = identity.revision;
	if (plan.owner === "grouping") {
		const classification = await ensureCatalogDefinition(tx, {
			namespace: "catalog",
			key: "series",
			kind: "class",
			valueKind: null,
		});
		revision = (await assignGroupingClass(tx, identity, actor, revision, classification.revisionId))
			.revision;
	}
	const tables = CatalogFactTables[plan.owner];
	for (const name of plan.names) {
		const created = await addCatalogName(tx, identity, actor, revision, name);
		revision = created.revision;
		await tx.insert(tables.support).values({
			ownerId: identity.id,
			namedFormId: created.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: name.kind === "source-primary" ? "/name" : "/name_cn",
		});
	}
	const [identifier] = await tx
		.insert(tables.identifier)
		.values({
			ownerId: identity.id,
			namespace: "bangumi.subject",
			value: String(plan.subject.id),
			normalizedValue: String(plan.subject.id),
		})
		.returning({ id: tables.identifier.id });
	if (!identifier) throw new Error("Source identifier insertion returned no row");
	await tx.insert(tables.support).values({
		ownerId: identity.id,
		identifierId: identifier.id,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: "/id",
	});
	for (const field of BangumiSubjectSchema.keyof().options) {
		const value = plan.subject[field];
		if (value === undefined) continue;
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "source.bangumi.subject",
			key: field,
			kind: "property",
			valueKind: bangumiValueKinds[field],
		});
		const fact = await beginCatalogFact(tx, identity, actor, revision, definition.revisionId);
		revision = fact.revision;
		let position = -1;
		let batch = [];
		for (const node of catalogValueNodes(value)) {
			batch.push(node);
			if (batch.length === 512) {
				const appended = await appendCatalogFactNodes(
					tx,
					identity,
					actor,
					revision,
					fact.id,
					position,
					batch,
				);
				revision = appended.revision;
				position = appended.lastNodePosition;
				batch = [];
			}
		}
		if (batch.length) {
			const appended = await appendCatalogFactNodes(
				tx,
				identity,
				actor,
				revision,
				fact.id,
				position,
				batch,
			);
			revision = appended.revision;
			position = appended.lastNodePosition;
		}
		revision = (await sealCatalogFact(tx, identity, actor, revision, fact.id, position)).revision;
		await tx.insert(tables.support).values({
			ownerId: identity.id,
			factId: fact.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: `/${field}`,
		});
	}
	const [claim] = await tx
		.insert(catalogSourceMappingClaim)
		.values({
			sourceRecordId: observation.record.id,
			path: "/",
			owner: plan.owner,
			observedSnapshotId: observation.snapshot.id,
		})
		.returning();
	if (!claim) throw new Error("Source mapping claim insertion returned no row");
	await tx
		.insert(tables.sourceBinding)
		.values({ mappingKey: claim.mappingKey, mappingOwner: plan.owner, ownerId: identity.id });
	return {
		status: "created" as const,
		reference: { owner: plan.owner, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}

export async function getSourceBoundReference(
	tx: DatabaseTransaction,
	sourceRecordId: string,
	actor: string | null,
): Promise<{ owner: CatalogOwner; id: string } | null> {
	const bound = await findBoundIdentity(tx, sourceRecordId);
	if (bound) await loadCatalogIdentity(tx, bound.reference, actor, false);
	return bound?.reference ?? null;
}
