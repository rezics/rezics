import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import {
	catalogSourceRecord,
	catalogSourceMappingClaim as claims,
	catalogSourceBindingRevision as revisions,
	catalogSourceSubscription as subscriptions,
} from "../database/schema/catalog-source";
import { type CatalogReference, CatalogReferenceSchema } from "./contracts";
import { loadCatalogIdentity } from "./storage";
import { appendOperationalOutbox } from "../events/durability";
import { aggregateRoutingBucket, eventEnvelopeSchema } from "../events/envelope";

const keySchema = z.strictObject({ sourceRecordId: z.uuid(), mappingKey: z.uuid() });
export type CatalogBindingKey = z.infer<typeof keySchema>;

/** @internal All source and binding mutations use source -> mapping -> native lock order. */
export async function lockCatalogSourceBinding(tx: DatabaseTransaction, input: CatalogBindingKey) {
	const key = keySchema.parse(input);
	const [source] = await tx
		.select()
		.from(catalogSourceRecord)
		.where(eq(catalogSourceRecord.id, key.sourceRecordId))
		.limit(1)
		.for("update");
	if (!source) throw new Error("Source record does not exist");
	const [claim] = await tx
		.select()
		.from(claims)
		.where(
			and(eq(claims.sourceRecordId, key.sourceRecordId), eq(claims.mappingKey, key.mappingKey)),
		)
		.limit(1)
		.for("update");
	if (!claim) throw new Error("Source binding does not exist");
	const table = CatalogFactTables[claim.owner].sourceBinding;
	const [binding] = await tx
		.select()
		.from(table)
		.where(and(eq(table.sourceRecordId, key.sourceRecordId), eq(table.mappingKey, key.mappingKey)))
		.limit(1)
		.for("update");
	if (!binding) throw new Error("Source binding has no checked native target");
	return { source, claim, binding, reference: { owner: claim.owner, id: binding.ownerId } };
}

function targetColumns(reference: CatalogReference) {
	return {
		publishingId: reference.owner === "publishing" ? reference.id : null,
		musicId: reference.owner === "music" ? reference.id : null,
		programId: reference.owner === "program" ? reference.id : null,
		softwareId: reference.owner === "software" ? reference.id : null,
		entityId: reference.owner === "entity" ? reference.id : null,
		groupingId: reference.owner === "grouping" ? reference.id : null,
		referenceId: reference.owner === "reference" ? reference.id : null,
	};
}

/** @internal Initial correspondence records an immutable target/policy revision atomically. */
export async function bindCatalogSourceIdentity(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		sourceRecordId: string;
		path: string;
		snapshotId: string;
		reference: CatalogReference;
	},
) {
	const value = z
		.strictObject({
			sourceRecordId: z.uuid(),
			path: z.string().min(1).max(512),
			snapshotId: z.uuid(),
			reference: CatalogReferenceSchema,
		})
		.parse(input);
	const [source] = await tx
		.select()
		.from(catalogSourceRecord)
		.where(eq(catalogSourceRecord.id, value.sourceRecordId))
		.limit(1)
		.for("update");
	if (!source) throw new Error("Source record does not exist");
	await loadCatalogIdentity(tx, value.reference, actor, true);
	const [claim] = await tx
		.insert(claims)
		.values({
			sourceRecordId: value.sourceRecordId,
			path: value.path,
			observedSnapshotId: value.snapshotId,
			owner: value.reference.owner,
			mappingVersion: `${source.source}.${source.objectType}.1`,
		})
		.returning();
	if (!claim) throw new Error("Source binding insert failed");
	await tx.insert(CatalogFactTables[value.reference.owner].sourceBinding).values({
		sourceRecordId: value.sourceRecordId,
		mappingKey: claim.mappingKey,
		mappingOwner: value.reference.owner,
		ownerId: value.reference.id,
	});
	await tx.insert(revisions).values({
		sourceRecordId: value.sourceRecordId,
		mappingKey: claim.mappingKey,
		owner: value.reference.owner,
		revision: 1,
		policyRevision: 1,
		state: "active",
		mode: "review",
		actorAuthUserId: actor,
		reason: "Initial reviewed source correspondence",
		...targetColumns(value.reference),
	});
	await tx.insert(subscriptions).values({
		sourceRecordId: value.sourceRecordId,
		mappingKey: claim.mappingKey,
		owner: value.reference.owner,
		state: "active",
	});
	return claim;
}

/** @internal Only an unchanged reference stub may receive its first own-endpoint details without review. */
export async function acceptCatalogSourceInitialization(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		sourceRecordId: string;
		path: string;
		snapshotId: string;
		reference: CatalogReference;
		expectedBaselineRevision: number;
		finalRevision: number;
	},
) {
	const value = z
		.strictObject({
			sourceRecordId: z.uuid(),
			path: z.string().min(1).max(512),
			snapshotId: z.uuid(),
			reference: CatalogReferenceSchema,
			expectedBaselineRevision: z.number().int().positive(),
			finalRevision: z.number().int().positive(),
		})
		.parse(input);
	const [locator] = await tx
		.select()
		.from(claims)
		.where(and(eq(claims.sourceRecordId, value.sourceRecordId), eq(claims.path, value.path)))
		.limit(1);
	if (!locator) throw new Error("Referenced source claim is missing");
	const current = await lockCatalogSourceBinding(tx, {
		sourceRecordId: value.sourceRecordId,
		mappingKey: locator.mappingKey,
	});
	const native = await loadCatalogIdentity(tx, current.reference, actor, true);
	if (
		current.reference.owner !== value.reference.owner ||
		current.reference.id !== value.reference.id ||
		current.claim.observedSnapshotId !== null ||
		current.claim.baselineTargetRevision !== value.expectedBaselineRevision ||
		current.claim.state !== "active" ||
		current.source.headSnapshotId !== value.snapshotId ||
		native.revision !== value.finalRevision ||
		value.finalRevision < value.expectedBaselineRevision
	)
		throw new Error("Source reference initialization fence changed");
	await tx
		.update(claims)
		.set({
			observedSnapshotId: value.snapshotId,
			evidenceSourceRecordId: null,
			evidenceSnapshotId: null,
			evidencePath: null,
			baselineTargetRevision: null,
		})
		.where(
			and(
				eq(claims.sourceRecordId, value.sourceRecordId),
				eq(claims.mappingKey, locator.mappingKey),
			),
		);
	return { revision: native.revision };
}

/** @internal Outbox publication shares the transaction of the changed source authority. */
export async function appendSourceLifecycleEvent(
	tx: DatabaseTransaction,
	sourceRecordId: string,
	kind: "source.binding.changed" | "source.adoption.decided" | "source.record.checked",
	revision: number,
	payload: Record<string, unknown>,
) {
	await appendOperationalOutbox(tx, [
		eventEnvelopeSchema.parse({
			version: 1,
			messageId: crypto.randomUUID(),
			class: "event",
			kind,
			occurredAt: new Date().toISOString(),
			correlationId: null,
			causationId: null,
			routingEpoch: 1,
			routingBucket: aggregateRoutingBucket("source_record", sourceRecordId),
			aggregate: { owner: "source_record", key: sourceRecordId, revision: String(revision) },
			payload,
		}),
	]);
}

/** @internal Pause/resume/rebind atomically changes the fence; old proposals cannot write. */
export async function reviseCatalogSourceBinding(
	tx: DatabaseTransaction,
	actor: string,
	input: CatalogBindingKey & {
		expectedRevision: number;
		state: "active" | "paused" | "withdrawn";
		mode: "review" | "manual";
		reason: string;
		target?: CatalogReference;
	},
) {
	const value = keySchema
		.extend({
			expectedRevision: z
				.number()
				.int()
				.positive()
				.max(Number.MAX_SAFE_INTEGER - 1),
			state: z.enum(["active", "paused", "withdrawn"]),
			mode: z.enum(["review", "manual"]),
			reason: z.string().min(1).max(2048),
			target: CatalogReferenceSchema.optional(),
		})
		.parse(input);
	const current = await lockCatalogSourceBinding(tx, {
		sourceRecordId: value.sourceRecordId,
		mappingKey: value.mappingKey,
	});
	await loadCatalogIdentity(tx, current.reference, actor, true);
	if (current.claim.bindingRevision !== value.expectedRevision)
		throw new Error("Source binding revision is stale");
	const reference = value.target ?? current.reference;
	if (reference.owner !== current.reference.owner)
		throw new Error("Cross-owner rebind requires a new checked mapping");
	await loadCatalogIdentity(tx, reference, actor, true);
	// Persist the initial legacy-in-transaction head before its first edit as well.
	await tx
		.insert(revisions)
		.values({
			...value,
			revision: current.claim.bindingRevision,
			policyRevision: current.claim.policyRevision,
			owner: reference.owner,
			state: current.claim.state,
			mode: "review",
			actorAuthUserId: actor,
			reason: "Recorded initial source correspondence",
			...targetColumns(current.reference),
		})
		.onConflictDoNothing();
	const revision = current.claim.bindingRevision + 1;
	const policyRevision = current.claim.policyRevision + 1;
	await tx.insert(revisions).values({
		sourceRecordId: value.sourceRecordId,
		mappingKey: value.mappingKey,
		revision,
		policyRevision,
		owner: reference.owner,
		state: value.target ? "paused" : value.state,
		mode: value.mode,
		actorAuthUserId: actor,
		reason: value.reason,
		...targetColumns(reference),
	});
	await tx
		.update(claims)
		.set({
			bindingRevision: revision,
			policyRevision,
			state: value.target ? "paused" : value.state,
		})
		.where(
			and(eq(claims.sourceRecordId, value.sourceRecordId), eq(claims.mappingKey, value.mappingKey)),
		);
	if (value.target) {
		const table = CatalogFactTables[reference.owner].sourceBinding;
		await tx
			.update(table)
			.set({ ownerId: reference.id })
			.where(
				and(eq(table.sourceRecordId, value.sourceRecordId), eq(table.mappingKey, value.mappingKey)),
			);
	}
	await tx
		.insert(subscriptions)
		.values({
			sourceRecordId: value.sourceRecordId,
			mappingKey: value.mappingKey,
			owner: reference.owner,
			revision,
			state: value.state === "active" && !value.target ? "active" : "paused",
		})
		.onConflictDoUpdate({
			target: [subscriptions.sourceRecordId, subscriptions.mappingKey],
			set: {
				revision,
				state: value.state === "active" && !value.target ? "active" : "paused",
				updatedAt: new Date(),
			},
		});
	// Pending rows are invalidated lazily by their fence, avoiding an unbounded history update.
	await appendSourceLifecycleEvent(tx, value.sourceRecordId, "source.binding.changed", revision, {
		mappingKey: value.mappingKey,
		bindingRevision: revision,
	});
	return {
		revision,
		policyRevision,
		reference,
		state: value.target ? ("paused" as const) : value.state,
	};
}

/** @internal Keyset pages retain immutable revisions; no whole-binding history reads. */
export async function listCatalogBindingRevisions(
	tx: DatabaseTransaction,
	actor: string,
	input: CatalogBindingKey,
	afterRevision = 0,
	limit = 50,
) {
	z.number().int().min(0).parse(afterRevision);
	z.number().int().min(1).max(100).parse(limit);
	const binding = await lockCatalogSourceBinding(tx, input);
	await loadCatalogIdentity(tx, binding.reference, actor, false);
	return tx
		.select()
		.from(revisions)
		.where(
			and(
				eq(revisions.sourceRecordId, input.sourceRecordId),
				eq(revisions.mappingKey, input.mappingKey),
				gt(revisions.revision, afterRevision),
			),
		)
		.orderBy(revisions.revision)
		.limit(limit);
}
