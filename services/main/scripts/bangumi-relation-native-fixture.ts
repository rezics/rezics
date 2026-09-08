import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../src/services/database";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { CatalogFactTables } from "../src/services/database/schema/catalog-facts";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import {
	storeCatalogSourcePayload,
	recordCatalogSourceDocument,
	catalogSourceRecordId,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { BangumiArchiveContractSha256 } from "../src/services/catalog/bangumi-contracts";
import {
	BangumiArchiveRelationSchema,
	bangumiRelationKey,
} from "../src/services/catalog/bangumi-records";
import {
	adoptBangumiArchiveRelation,
	planBangumiArchiveRelation,
	BangumiRelationMappingSchema,
} from "../src/services/catalog/bangumi-relations";
import { resolveBangumiDependency } from "../src/services/catalog/bangumi-adoption";
import {
	createBangumiNativeWriter,
	prepareBangumiProposalDependencies,
} from "../src/services/catalog/bangumi-native";
import { BangumiArchiveRelationMappingVersion } from "../src/services/catalog/bangumi-relation-native";
import { ensureCatalogDefinition, loadCatalogIdentity } from "../src/services/catalog/storage";
import { resolveCatalogSourceChildCorrespondence } from "../src/services/catalog/source-child-correspondence";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
} from "../src/services/catalog/source-proposals";
import { issueParticipationGrant } from "../src/services/participation/commands";
import {
	currentParticipationAuthority,
	runWithParticipationAuthority,
} from "../src/services/participation/policy";
import { z } from "zod";

/** All five archive relation families use the same governed native source application path. @internal */
export async function checkBangumiNativeRelations(tx: DatabaseTransaction, actor: string) {
	const rows = [
		{
			before: {
				kind: "subject-relations",
				subject_id: 950001,
				related_subject_id: 950005,
				relation_type: 1,
				order: 1,
			},
			after: { order: 2 },
		},
		{
			before: {
				kind: "subject-persons",
				subject_id: 950001,
				person_id: 950002,
				position: 1,
				appear_eps: "1-2",
			},
			after: { appear_eps: "3-4" },
		},
		{
			before: {
				kind: "subject-characters",
				subject_id: 950001,
				character_id: 950003,
				type: 1,
				order: 1,
			},
			after: { order: 2 },
		},
		{
			before: {
				kind: "person-characters",
				subject_id: 950001,
				person_id: 950002,
				character_id: 950003,
				type: 0,
				summary: "First credit",
			},
			after: { type: 1, summary: "Revised credit" },
		},
		{
			before: {
				kind: "person-relations",
				person_type: "prsn",
				person_id: 950002,
				related_person_id: 950002,
				relation_type: 1,
				spoiler: false,
				ended: false,
			},
			after: { spoiler: true, ended: true },
		},
	];
	const payloads = new Map<string, Uint8Array>();
	const archive: CatalogSourceArchive = {
		async put(value) {
			payloads.set(value.Key, value.Body);
		},
		async get({ Key }) {
			const body = payloads.get(Key);
			return { Body: body ? Readable.from([body]) : undefined };
		},
	};
	let checks = 0;
	for (const scenario of rows) {
		const beforeRow = BangumiArchiveRelationSchema.parse(scenario.before),
			afterRow = BangumiArchiveRelationSchema.parse({ ...scenario.before, ...scenario.after });
		const plan = planBangumiArchiveRelation(beforeRow),
			incoming = planBangumiArchiveRelation(afterRow);
		const first = plan.participants[0];
		assert.ok(first);
		const reference = await resolveBangumiDependency(tx, actor, first.objectType, first.id);
		const roles: z.output<typeof BangumiRelationMappingSchema>["roles"] = {},
			qualifiers: z.output<typeof BangumiRelationMappingSchema>["qualifiers"] = {};
		const constraints = [];
		for (const participant of plan.participants) {
			const target = await resolveBangumiDependency(
					tx,
					actor,
					participant.objectType,
					participant.id,
				),
				identity = await loadCatalogIdentity(tx, target, actor, false);
			const role = await ensureCatalogDefinition(tx, {
				namespace: "acceptance.bangumi",
				key: `${beforeRow.kind}.${participant.role}`,
				kind: "role",
				valueKind: null,
			});
			roles[participant.role] = role.revisionId;
			constraints.push({
				roleRevisionId: role.revisionId,
				min: 1,
				max: 1,
				targets: [{ owner: target.owner, shapes: [identity.shape] }],
			});
		}
		for (const qualifier of plan.qualifiers) {
			const definition = await ensureCatalogDefinition(tx, {
				namespace: "acceptance.bangumi",
				key: `${beforeRow.kind}.${qualifier.key}`,
				kind: "property",
				valueKind:
					typeof qualifier.value === "number"
						? "number"
						: typeof qualifier.value === "boolean"
							? "boolean"
							: "string",
			});
			qualifiers[qualifier.key] = definition.revisionId;
		}
		const predicate = await ensureCatalogDefinition(tx, {
			namespace: "acceptance.bangumi",
			key: beforeRow.kind,
			kind: "predicate",
			valueKind: null,
			constraints: { roles: constraints, qualifierRevisionIds: Object.values(qualifiers) },
		});
		const mapping = BangumiRelationMappingSchema.parse({
			predicateRevisionId: predicate.revisionId,
			roles,
			qualifiers,
		});
		const key = {
				source: "bangumi",
				objectType: beforeRow.kind,
				externalId: bangumiRelationKey(beforeRow),
			},
			sourceRecordId = catalogSourceRecordId(key);
		await tx
			.insert(operationalCapacity)
			.values(
				["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
					routingBucket: aggregateRoutingBucket("source_record", sourceRecordId),
					lane,
					maximumRows: 10000n,
					maximumBytes: 64000000n,
				})),
			)
			.onConflictDoNothing();
		const snapshot = async (row: typeof beforeRow) => {
			const bytes = Buffer.from(JSON.stringify(row));
			const receipt = await storeCatalogSourcePayload(
				key,
				bytes,
				BangumiArchiveContractSha256,
				null,
				archive,
			);
			const document = await recordCatalogSourceDocument(tx, receipt, bytes);
			return { bytes, receipt, snapshotId: document.snapshot.id };
		};
		const before = await snapshot(beforeRow);
		const native = await adoptBangumiArchiveRelation(
			tx,
			reference,
			actor,
			(await loadCatalogIdentity(tx, reference, actor, true)).revision,
			before.receipt,
			before.bytes,
			mapping,
		);
		assert.equal(native.status, "created");
		if (!("semanticId" in native)) throw new Error("Expected initialized native relation");
		checks++;
		const scope = await resolveCatalogSourceChildCorrespondence(tx, sourceRecordId),
			after = await snapshot(afterRow);
		const writer = createBangumiNativeWriter({ before, after, relationMapping: mapping });
		const f = CatalogFactTables[reference.owner];
		let nextRelationId: string | null = null;
		const checkNative = async (snapshotId: string, expected: typeof plan, requireId?: string) => {
			const [source] = await tx
				.select({ id: f.relation.id, semanticId: f.relation.semanticId })
				.from(f.support)
				.innerJoin(
					f.relation,
					and(eq(f.relation.ownerId, f.support.ownerId), eq(f.relation.id, f.support.relationId)),
				)
				.where(
					and(
						eq(f.support.ownerId, reference.id),
						eq(f.support.sourceRecordId, sourceRecordId),
						eq(f.support.snapshotId, snapshotId),
						eq(f.support.sourcePath, "/"),
					),
				)
				.limit(1);
			assert.ok(source);
			assert.equal(source.semanticId, native.semanticId);
			if (requireId) assert.equal(source.id, requireId);
			checks++;
			const [live] = await tx
				.select({ id: f.semanticRevision.relationId, state: f.semanticRevision.state })
				.from(f.semanticHead)
				.innerJoin(
					f.semanticRevision,
					and(
						eq(f.semanticRevision.ownerId, f.semanticHead.ownerId),
						eq(f.semanticRevision.semanticId, f.semanticHead.semanticId),
						eq(f.semanticRevision.version, f.semanticHead.version),
					),
				)
				.where(
					and(
						eq(f.semanticHead.ownerId, reference.id),
						eq(f.semanticHead.semanticId, native.semanticId),
					),
				)
				.limit(1);
			assert.equal(live?.id, source.id);
			assert.equal(live?.state, "active");
			checks += 2;
			const values = await tx
				.select({
					definitionRevisionId: f.relationScope.definitionRevisionId,
					kind: f.valueNode.kind,
					text: f.valueNode.textValue,
					number: f.valueNode.numberValue,
					boolean: f.valueNode.booleanValue,
				})
				.from(f.relationScope)
				.innerJoin(
					f.valueNode,
					and(
						eq(f.valueNode.ownerId, f.relationScope.ownerId),
						eq(f.valueNode.factId, f.relationScope.valueFactId),
						eq(f.valueNode.position, 0),
					),
				)
				.where(
					and(eq(f.relationScope.ownerId, reference.id), eq(f.relationScope.relationId, source.id)),
				)
				.limit(65);
			for (const qualifier of expected.qualifiers) {
				const value = values.find(
					(item) => item.definitionRevisionId === mapping.qualifiers[qualifier.key],
				);
				assert.ok(value);
				assert.equal(
					value.kind === "number"
						? Number(value.number)
						: value.kind === "boolean"
							? value.boolean
							: value.text,
					qualifier.value,
				);
				checks++;
			}
			return source.id;
		};
		for (let cycle = 0; cycle < 2; cycle++) {
			const proposed = await proposeCatalogSourceAdoption(tx, actor, {
				sourceRecordId,
				mappingKey: scope.mappingKey,
				snapshotId: after.snapshotId,
				mappingVersion: BangumiArchiveRelationMappingVersion,
			});
			if (!("proposal" in proposed) || !proposed.proposal)
				throw new Error("Expected relation review proposal");
			await prepareBangumiProposalDependencies(tx, actor, {
				...after,
				before,
				sourceRecordId,
				proposalId: proposed.proposal.id,
			});
			const authority = currentParticipationAuthority();
			assert.ok(authority);
			const grant = await issueParticipationGrant(tx, authority, {
				recipient: { kind: "auth", authUserId: actor },
				actingEntityId: authority.actingEntityId,
				capability: "proposal.adopt",
				target: reference,
				proposal: { sourceRecordId, proposalId: proposed.proposal.id },
			});
			const selected = { ...authority, grant },
				decision = {
					sourceRecordId,
					proposalId: proposed.proposal.id,
					mappingVersion: BangumiArchiveRelationMappingVersion,
					reason: "Qualify native Bangumi relation and qualifier compensation",
				};
			assert.equal(
				(
					await runWithParticipationAuthority(selected, () =>
						decideCatalogSourceProposal(tx, actor, { ...decision, action: "apply" }, writer),
					)
				).status,
				"applied",
			);
			checks++;
			nextRelationId = await checkNative(after.snapshotId, incoming, nextRelationId ?? undefined);
			assert.equal(
				(
					await runWithParticipationAuthority(selected, () =>
						decideCatalogSourceProposal(tx, actor, { ...decision, action: "withdraw" }, writer),
					)
				).status,
				"withdrawn",
			);
			checks++;
			await checkNative(before.snapshotId, plan, native.id);
		}
	}
	return checks;
}
