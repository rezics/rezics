import { catalogSourceSupportColumns } from "./source-support";
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
import { type CatalogOwner } from "./contracts";
import { BangumiSubjectContractSha256, planBangumiSubject } from "./bangumi";
import { planBangumiArchiveSubject } from "./bangumi-records";
import { BangumiArchiveContractSha256 } from "./bangumi-adoption";
import {
	type CatalogSourceReceipt,
	recordCatalogSourceObservation,
	recordCatalogSourceDocument,
} from "./source-observations";
import {
	addCatalogName,
	createCatalogIdentity,
	ensureCatalogDefinition,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";
import { assignGroupingClass } from "./grouping";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";

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
		.where(
			and(
				eq(bindingTable.sourceRecordId, sourceRecordId),
				eq(bindingTable.mappingKey, claim.mappingKey),
			),
		)
		.limit(1);
	if (!binding) throw new Error("Source mapping claim has no native binding");
	const identityTable = CatalogIdentityTables[claim.owner];
	const [identity] = await tx
		.select()
		.from(identityTable)
		.where(eq(identityTable.id, binding.ownerId))
		.limit(1);
	if (!identity) throw new Error("Source binding target is missing");
	return {
		claim,
		identity,
		reference: { owner: claim.owner, id: identity.id },
	};
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
		if (bound.claim.state !== "active")
			return {
				status: "paused" as const,
				reference: bound.reference,
				revision: bound.identity.revision,
				snapshotId: observation.snapshot.id,
			};
		if (
			bound.claim.observedSnapshotId === null &&
			bound.claim.baselineTargetRevision === bound.identity.revision
		) {
			await loadCatalogIdentity(tx, bound.reference, actor, true);
			return {
				status: "initialize_reference" as const,
				reference: bound.reference,
				revision: bound.identity.revision,
				snapshotId: observation.snapshot.id,
			};
		}
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
			bound.claim.appliedCorrespondenceRevision === bound.claim.correspondenceRevision &&
			bound.claim.mappingVersion === mappingVersion &&
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
				expectedBindingRevision: bound.claim.bindingRevision,
				expectedPolicyRevision: bound.claim.policyRevision,
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
	format: "api" | "archive" = "api",
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new Error("Bangumi projection bytes differ from the archived observation");
	if (
		receipt.contractSha256 !==
		(format === "api" ? BangumiSubjectContractSha256 : BangumiArchiveContractSha256)
	)
		throw new Error("Bangumi source contract has not been reviewed for this mapper");
	const document: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const plan =
		format === "api" ? planBangumiSubject(document) : planBangumiArchiveSubject(document);
	if (
		receipt.key.source !== "bangumi" ||
		receipt.key.objectType !== "subject" ||
		receipt.key.externalId !== String(plan.subject.id)
	)
		throw new TypeError("Bangumi payload identity differs from its archived source record");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(tx, actor, observation, "bangumi.subject.1");
	if (existing && existing.status !== "initialize_reference") return existing;
	if (existing) {
		const target = await loadCatalogIdentity(tx, existing.reference, actor, true);
		if (existing.reference.owner !== plan.owner || target.shape !== plan.shape)
			throw new TypeError("Bangumi source grain needs reviewed native reclassification");
	}
	const identity = existing
		? { ...existing.reference, revision: existing.revision }
		: await createCatalogIdentity(
				tx,
				{
					owner: plan.owner,
					shape: plan.shape,
					contentRating: plan.contentRating,
				},
				actor,
			);
	await prepareCatalogSourceChildCorrespondence(tx, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		reference: identity,
		mappingVersion: "bangumi.subject.1",
	});
	if (plan.owner === "program") {
		const counts =
			"eps" in plan.subject
				? {
						declaredMainEpisodeCount: plan.subject.eps,
						declaredTotalEpisodeCount: plan.subject.total_episodes,
					}
				: {};
		await tx
			.insert(programWork)
			.values({
				id: identity.id,
				...counts,
			})
			.onConflictDoUpdate({
				target: programWork.id,
				set: { id: identity.id, ...counts },
			});
	}
	if (plan.owner === "software")
		await tx.insert(softwareContent).values({ id: identity.id }).onConflictDoNothing();
	let revision = identity.revision;
	if (plan.owner === "grouping") {
		const classification = await ensureCatalogDefinition(tx, {
			namespace: "catalog",
			key: "series",
			kind: "class",
			valueKind: null,
			constraints: { targets: [{ owner: "grouping", shapes: ["grouping"] }] },
		});
		revision = (await assignGroupingClass(tx, identity, actor, revision, classification.revisionId))
			.revision;
	}
	const tables = CatalogFactTables[plan.owner];
	for (const name of plan.names) {
		const created = await addCatalogName(tx, identity, actor, revision, name);
		revision = created.revision;
		await tx.insert(tables.support).values({
			...(await catalogSourceSupportColumns(tx, observation.record.id)),
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
		.returning({ id: tables.identifier.id, identifierRevision: tables.identifier.revision });
	if (!identifier) throw new Error("Source identifier insertion returned no row");
	await tx.insert(tables.support).values({
		...(await catalogSourceSupportColumns(tx, observation.record.id)),
		ownerId: identity.id,
		identifierId: identifier.id,
		identifierRevision: identifier.identifierRevision,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: "/id",
	});
	if (existing && plan.contentRating === "r18") {
		revision = await recordCatalogChange(
			tx,
			identity,
			actor,
			revision,
			"subject.content-rating.initialize",
		);
		const table = CatalogIdentityTables[plan.owner];
		await tx.update(table).set({ contentRating: "r18" }).where(eq(table.id, identity.id));
	}
	const binding = {
		mappingVersion: "bangumi.subject.1",
		sourceRecordId: observation.record.id,
		path: "/",
		snapshotId: observation.snapshot.id,
		reference: { owner: identity.owner, id: identity.id },
	};
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			...binding,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else await sealCatalogSourceChildCorrespondence(tx, actor, { ...binding, path: "/" });
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
