import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../src/services/database";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import {
	applyCatalogSourceRelationDelta,
	type CatalogSourceRelationDescriptor,
} from "../src/services/catalog/source-relation-delta";
import {
	createCatalogRelation,
	ensureCatalogDefinition,
	loadCatalogIdentity,
	recordCatalogChange,
} from "../src/services/catalog/storage";
import {
	proposeCatalogSourceAdoption,
	decideCatalogSourceProposal,
	type CatalogSourceNativeWriter,
} from "../src/services/catalog/source-proposals";
import { readCatalogSourceApplication } from "../src/services/catalog/source-applications";
import { compensateCatalogSourceOwnedChange } from "../src/services/catalog/source-owned-compensation";
import {
	loadCatalogSourceDocument,
	type CatalogSourceReceipt,
} from "../src/services/catalog/source-observations";

type Snapshot = { snapshotId: string; receipt: CatalogSourceReceipt; bytes: Uint8Array };
/** Exercises relation primitives independently of provider-specific relationship inference. @internal */
export async function checkSourceRelationDelta(
	tx: DatabaseTransaction,
	actor: string,
	reference: CatalogReference,
	input: {
		before: Snapshot;
		after: Snapshot;
		sourceRecordId: string;
		mappingKey: string;
		mappingVersion: string;
	},
) {
	let checks = 0;
	const owner = await loadCatalogIdentity(tx, reference, actor, true);
	const role = await ensureCatalogDefinition(tx, {
		namespace: "acceptance",
		key: "self-reference",
		kind: "role",
		valueKind: null,
	});
	const predicate = await ensureCatalogDefinition(tx, {
		namespace: "acceptance",
		key: "source-relation-delta",
		kind: "predicate",
		valueKind: null,
		constraints: {
			roles: [
				{
					roleRevisionId: role.revisionId,
					min: 1,
					max: 1,
					targets: [{ owner: reference.owner, shapes: [owner.shape] }],
				},
			],
		},
	});
	const descriptor = (
		identity: string,
		path: string,
		spoiler: 0 | 1 | 2 = 0,
	): CatalogSourceRelationDescriptor => ({
		identity,
		path,
		value: {
			definitionRevisionId: predicate.revisionId,
			participants: [{ roleRevisionId: role.revisionId, target: reference }],
			spoiler,
		},
	});
	const before = [
		descriptor("change", "/relations/0"),
		descriptor("stable", "/relations/1"),
		descriptor("remove", "/relations/2"),
	];
	const after = [
		descriptor("stable", "/relations/0"),
		descriptor("change", "/relations/1", 1),
		descriptor("add", "/relations/2"),
	];
	const oldDocument = await loadCatalogSourceDocument(
		tx,
		input.sourceRecordId,
		input.before.snapshotId,
		input.before.receipt,
		input.before.bytes,
	);
	const nextDocument = await loadCatalogSourceDocument(
		tx,
		input.sourceRecordId,
		input.after.snapshotId,
		input.after.receipt,
		input.after.bytes,
	);
	const initial = await applyCatalogSourceRelationDelta(
		tx,
		reference,
		actor,
		owner.revision,
		oldDocument,
		null,
		before,
	);
	const stable = initial.relations.find((item) => item.identity === "stable");
	assert.ok(stable);
	await createCatalogRelation(tx, reference, actor, initial.revision, {
		...before[1]!.value,
		spoiler: 2,
		semanticId: stable.semanticId,
		expectedHeadVersion: 1,
	});
	const f = CatalogFactTables[reference.owner];
	const current = async (semanticId: string) => {
		const [row] = await tx
			.select({ relationId: f.semanticRevision.relationId, state: f.semanticRevision.state })
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
				and(eq(f.semanticHead.ownerId, reference.id), eq(f.semanticHead.semanticId, semanticId)),
			)
			.limit(1);
		assert.ok(row);
		const [relation] = row.relationId
			? await tx
					.select({ spoiler: f.relation.spoiler })
					.from(f.relation)
					.where(and(eq(f.relation.ownerId, reference.id), eq(f.relation.id, row.relationId)))
					.limit(1)
			: [];
		return { ...row, spoiler: relation?.spoiler };
	};
	const writer: CatalogSourceNativeWriter = async (write, context) => {
		assert.equal(context.snapshotId, input.after.snapshotId);
		if (context.action === "apply")
			assert.equal(context.previousSnapshotId, input.before.snapshotId);
		if (context.action === "withdraw") {
			const applied = await readCatalogSourceApplication(write, actor, {
				sourceRecordId: input.sourceRecordId,
				proposalId: context.proposalId,
				action: "apply",
			});
			assert.ok(applied);
			const changes = [];
			for (const change of [...applied.changes].reverse()) {
				if (change.kind !== "catalog-semantic")
					throw new Error("Unexpected relation fixture journal");
				changes.push(await compensateCatalogSourceOwnedChange(write, actor, change));
			}
			return {
				revision: (await loadCatalogIdentity(write, reference, actor, true)).revision,
				changes,
			};
		}
		const changed = await applyCatalogSourceRelationDelta(
			write,
			reference,
			actor,
			context.expectedRevision,
			nextDocument,
			{ snapshotId: input.before.snapshotId, mappingKey: input.mappingKey, descriptors: before },
			after,
		);
		changed.revision = await recordCatalogChange(
			write,
			reference,
			actor,
			changed.revision,
			"fixture.source.relation.delta",
		);
		return changed;
	};
	let addedIdentity: string | null = null;
	for (let cycle = 0; cycle < 3; cycle++) {
		const proposed = await proposeCatalogSourceAdoption(tx, actor, {
			sourceRecordId: input.sourceRecordId,
			mappingKey: input.mappingKey,
			snapshotId: input.after.snapshotId,
			mappingVersion: input.mappingVersion,
		});
		if (!("proposal" in proposed) || !proposed.proposal)
			throw new Error("Expected relation fixture proposal");
		const decision = {
			sourceRecordId: input.sourceRecordId,
			proposalId: proposed.proposal.id,
			mappingVersion: input.mappingVersion,
			reason: "Native source relation compensation qualification",
		};
		assert.equal(
			(await decideCatalogSourceProposal(tx, actor, { ...decision, action: "apply" }, writer))
				.status,
			"applied",
		);
		checks++;
		assert.equal((await current(stable.semanticId)).spoiler, 2);
		checks++;
		const change = initial.relations.find((item) => item.identity === "change"),
			removed = initial.relations.find((item) => item.identity === "remove");
		assert.ok(change);
		assert.ok(removed);
		assert.equal((await current(change.semanticId)).spoiler, 1);
		assert.equal((await current(removed.semanticId)).state, "superseded");
		checks += 2;
		const [added] = await tx
			.select({ semanticId: f.relation.semanticId })
			.from(f.support)
			.innerJoin(
				f.relation,
				and(eq(f.relation.ownerId, f.support.ownerId), eq(f.relation.id, f.support.relationId)),
			)
			.where(
				and(
					eq(f.support.ownerId, reference.id),
					eq(f.support.sourceRecordId, input.sourceRecordId),
					eq(f.support.snapshotId, input.after.snapshotId),
					eq(f.support.sourcePath, "/relations/2"),
				),
			)
			.limit(1);
		assert.ok(added);
		if (addedIdentity) assert.equal(added.semanticId, addedIdentity);
		addedIdentity = added.semanticId;
		checks++;
		await assert.rejects(
			() =>
				tx.transaction(async (nested) => {
					const [frontier] = await nested
						.select()
						.from(f.semanticHead)
						.where(
							and(
								eq(f.semanticHead.ownerId, reference.id),
								eq(f.semanticHead.semanticId, change.semanticId),
							),
						)
						.limit(1);
					assert.ok(frontier);
					const live = await loadCatalogIdentity(nested, reference, actor, true);
					await createCatalogRelation(nested, reference, actor, live.revision, {
						...after[1]!.value,
						spoiler: 2,
						semanticId: change.semanticId,
						expectedHeadVersion: frontier.version,
					});
					await decideCatalogSourceProposal(
						nested,
						actor,
						{ ...decision, action: "withdraw" },
						writer,
					);
				}),
			/changed|conflict|independent/iu,
		);
		checks++;
		assert.equal(
			(await decideCatalogSourceProposal(tx, actor, { ...decision, action: "withdraw" }, writer))
				.status,
			"withdrawn",
		);
		checks++;
		assert.equal((await current(stable.semanticId)).spoiler, 2);
		assert.equal((await current(change.semanticId)).spoiler, 0);
		assert.equal((await current(removed.semanticId)).state, "active");
		assert.notEqual((await current(added.semanticId)).state, "active");
		checks += 4;
	}
	return checks;
}
