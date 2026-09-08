import { and, eq, gt, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { Authorization } from "../../authorization";
import { database, type DatabaseTransaction } from "../../database";
import {
	unitMergeRequest,
	unitMergeOperation,
	unitMergeGraphLock,
	unitMergeRedirect,
	unitMergeReconciliationItem,
} from "../../database/schema/unit-merge";
import { CatalogIdentityTables } from "../../database/schema/catalog-identity";
import { CatalogNameTables } from "../../database/schema/catalog-names";
import { CatalogFactTables } from "../../database/schema/catalog-facts";
import {
	catalogSourceMappingClaim,
	catalogSourceBindingRevision,
} from "../../database/schema/catalog-source";
import {
	ParticipationAuthoritySchema,
	runWithParticipationAuthority,
} from "../../participation/policy";
import { withCatalogViewerPolicy } from "../../catalog/read-policy";
import { addCatalogName } from "../../catalog/names";
import { addCatalogIdentifier } from "../../catalog/identifiers";
import { CatalogNameInputSchema } from "../../catalog/name-contracts";
import {
	reviseCatalogSourceBinding,
	lockCatalogSourceBinding,
} from "../../catalog/source-bindings";
import { readUnitStateById } from "../query";
import { nextUnitUpdatedAt } from "../update-values";
import { buildUnitMergeManifest, assertMergeManifestFingerprint } from "./manifest";
import { MergePlanSchema } from "./contracts";
import { humanMergeAuthority } from "./service";
import { UnitMergePolicy, nextUnitMergePhase, unitMergeRetryDelayMilliseconds } from "./policy";
import { databaseSqlState } from "../../database/constraint";
import { recordAuditEvent } from "../../audit";
import { CatalogRevisionConflict } from "../../catalog/storage";
import { ValidationError } from "../../api/errors";

type Op = typeof unitMergeOperation.$inferSelect;
type RequestRow = typeof unitMergeRequest.$inferSelect;
type Item = typeof unitMergeReconciliationItem.$inferSelect;
type ItemInsert = typeof unitMergeReconciliationItem.$inferInsert;
class ReconciliationRequired extends Error {
	constructor(readonly code: string) {
		super(code);
	}
}
export async function claimUnitMergeOperations(
	now: Date,
	limit = 4,
	shards: readonly number[] = Array.from({ length: 64 }, (_, i) => i),
) {
	const count = z.number().int().min(1).max(4).parse(limit),
		buckets = z
			.array(z.number().int().min(0).max(63))
			.min(1)
			.max(64)
			.parse([...new Set(shards)]);
	return database.transaction(async (tx) => {
		const expired = await tx
			.select({ id: unitMergeOperation.id })
			.from(unitMergeOperation)
			.where(
				and(
					inArray(unitMergeOperation.shard, buckets),
					eq(unitMergeOperation.state, "processing"),
					lte(unitMergeOperation.leaseExpiresAt, now),
				),
			)
			.orderBy(unitMergeOperation.leaseExpiresAt, unitMergeOperation.id)
			.limit(count)
			.for("update", { skipLocked: true });
		const pending =
			expired.length < count
				? await tx
						.select({ id: unitMergeOperation.id })
						.from(unitMergeOperation)
						.where(
							and(
								inArray(unitMergeOperation.shard, buckets),
								inArray(unitMergeOperation.state, ["pending", "retry_wait"]),
								lte(unitMergeOperation.availableAt, now),
							),
						)
						.orderBy(unitMergeOperation.availableAt, unitMergeOperation.id)
						.limit(count - expired.length)
						.for("update", { skipLocked: true })
				: [];
		const ids = [...expired, ...pending].map((row) => row.id);
		if (!ids.length) return [];
		return tx
			.update(unitMergeOperation)
			.set({
				state: "processing",
				leaseToken: sql`uuidv7()`,
				leaseExpiresAt: new Date(now.getTime() + UnitMergePolicy.workerLeaseDurationMs),
				startedAt: sql`coalesce(${unitMergeOperation.startedAt},${now})`,
			})
			.where(inArray(unitMergeOperation.id, ids))
			.returning();
	});
}
async function admitted<T>(
	tx: DatabaseTransaction,
	op: Op,
	work: (authorization: Authorization<string>) => Promise<T>,
): Promise<T> {
	const authority = ParticipationAuthoritySchema.parse(op.executorAuthority),
		authorization = new Authorization(op.executorProfileId, op.executorAuthUserId, authority);
	if (!(await authorization.platform.hasCapability("unit.merge", tx)))
		await authorization.platform.ensureCapability("unit.merge.propose", tx);
	await humanMergeAuthority(tx, authorization);
	return runWithParticipationAuthority(authority, () =>
		withCatalogViewerPolicy(tx, op.executorAuthUserId, () => work(authorization)),
	);
}
async function ensureItem(
	tx: DatabaseTransaction,
	op: Op,
	request: RequestRow,
	details: Pick<ItemInsert, "kind" | "sourceKey"> & Partial<ItemInsert>,
): Promise<Item> {
	const values = {
		...details,
		requestId: request.id,
		owner: request.owner,
		sourceUnitId: request.sourceUnitId,
		targetUnitId: request.targetUnitId,
		sourceOwnerRevision: request.sourceRevision,
	};
	const [created] = await tx
		.insert(unitMergeReconciliationItem)
		.values(values)
		.onConflictDoNothing()
		.returning();
	if (created) {
		await tx
			.update(unitMergeOperation)
			.set({ totalItems: sql`${unitMergeOperation.totalItems}+1` })
			.where(eq(unitMergeOperation.id, op.id));
		return created;
	}
	const [existing] = await tx
		.select()
		.from(unitMergeReconciliationItem)
		.where(
			and(
				eq(unitMergeReconciliationItem.requestId, request.id),
				eq(unitMergeReconciliationItem.kind, details.kind),
				eq(unitMergeReconciliationItem.sourceKey, details.sourceKey),
			),
		)
		.limit(1);
	if (!existing) throw new Error("Merge item collision did not resolve");
	return existing;
}
async function resolveItem(
	tx: DatabaseTransaction,
	op: Op,
	item: Item,
	decision: string,
	patch: Partial<ItemInsert> = {},
) {
	const [resolved] = await tx
		.update(unitMergeReconciliationItem)
		.set({
			...patch,
			state: decision.startsWith("retain") ? "retained" : "applied",
			decision,
			errorCode: null,
			resolvedAt: new Date(),
			resolvedByAuthUserId: op.executorAuthUserId,
		})
		.where(
			and(
				eq(unitMergeReconciliationItem.requestId, item.requestId),
				eq(unitMergeReconciliationItem.id, item.id),
				inArray(unitMergeReconciliationItem.state, ["pending", "action_required"]),
			),
		)
		.returning({ id: unitMergeReconciliationItem.id });
	if (resolved)
		await tx
			.update(unitMergeOperation)
			.set({ resolvedItems: sql`${unitMergeOperation.resolvedItems}+1` })
			.where(eq(unitMergeOperation.id, op.id));
}
async function actionRequired(tx: DatabaseTransaction, item: Item, code: string) {
	await tx
		.update(unitMergeReconciliationItem)
		.set({ state: "action_required", errorCode: code.slice(0, 128) })
		.where(
			and(
				eq(unitMergeReconciliationItem.requestId, item.requestId),
				eq(unitMergeReconciliationItem.id, item.id),
				inArray(unitMergeReconciliationItem.state, ["pending", "action_required"]),
			),
		);
}
function pending(item: Item) {
	return item.state === "pending" || item.state === "action_required";
}
async function sourceAndTarget(tx: DatabaseTransaction, request: RequestRow) {
	const source = await readUnitStateById(tx, request.sourceUnitId, { lock: "share" }),
		target = await readUnitStateById(tx, request.targetUnitId, { lock: "update" });
	if (
		!source ||
		!target ||
		source.visibility !== request.visibilityAtRequest ||
		target.visibility !== request.visibilityAtRequest ||
		source.reference.owner !== request.owner ||
		target.reference.owner !== request.owner ||
		source.shape !== request.shape ||
		target.shape !== request.shape ||
		source.moderationStatus !== "approved" ||
		target.moderationStatus !== "approved" ||
		source.contentRating !== target.contentRating
	)
		throw new ReconciliationRequired("source_or_target_policy_changed");
	return { source, target };
}
async function copyName(
	tx: DatabaseTransaction,
	op: Op,
	request: RequestRow,
	item: Item,
	depth = 0,
	anchor = false,
): Promise<{ id: string; revision: number }> {
	if (!item.sourceNameId || !item.sourceNameRevision)
		throw new ReconciliationRequired("missing_name_reference");
	if (!pending(item)) {
		if (item.targetNameId && item.targetNameRevision)
			return { id: item.targetNameId, revision: item.targetNameRevision };
		throw new ReconciliationRequired("retained_derivation_dependency");
	}
	if (depth > 8) throw new ReconciliationRequired("name_derivation_depth");
	const t = CatalogNameTables[request.owner].nameRevision;
	const [source] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.ownerId, request.sourceUnitId),
				eq(t.id, item.sourceNameId),
				eq(t.revision, item.sourceNameRevision),
			),
		)
		.limit(1);
	if (!source) throw new ReconciliationRequired("name_history_missing");
	let derivationNameId: string | null = null,
		derivationRevision: number | null = null;
	if (source.derivationNameId && source.derivationRevision) {
		const dependency = await ensureItem(tx, op, request, {
			kind: "name",
			sourceKey: `anchor:${source.derivationNameId}:${source.derivationRevision}`,
			sourceNameId: source.derivationNameId,
			sourceNameRevision: source.derivationRevision,
		});
		const copied = await copyName(tx, op, request, dependency, depth + 1, true);
		derivationNameId = copied.id;
		derivationRevision = copied.revision;
	}
	const { target } = await sourceAndTarget(tx, request);
	const value = CatalogNameInputSchema.parse({
		value: source.value,
		kind: source.kind,
		sortName: source.sortName,
		languageTag: source.languageTag,
		privateUseNamespace: source.privateUseNamespace,
		origin: source.origin,
		translationMethod: source.translationMethod,
		primaryForLanguage: false,
		scopeOwnerId:
			source.scopeOwnerId === request.sourceUnitId ? request.targetUnitId : source.scopeOwnerId,
		territory: source.territory,
		context: source.context,
		derivationNameId,
		derivationRevision,
		begin: source.begin,
		end: source.end,
		ended: source.ended,
		spoiler: source.spoiler,
		state: anchor ? "withdrawn" : source.state,
	});
	const copied = await addCatalogName(
		tx,
		{ owner: request.owner, id: request.targetUnitId },
		op.executorAuthUserId,
		target.revision,
		value,
	);
	await resolveItem(tx, op, item, anchor ? "copy_derivation_anchor" : "copy_alternate_name", {
		targetNameId: copied.id,
		targetNameRevision: copied.nameRevision,
		targetOwnerRevision: copied.revision,
	});
	return { id: copied.id, revision: copied.nameRevision };
}
async function copyIdentifier(tx: DatabaseTransaction, op: Op, request: RequestRow, item: Item) {
	if (!item.sourceIdentifierId || !item.sourceIdentifierRevision)
		throw new ReconciliationRequired("missing_identifier_reference");
	const t = CatalogNameTables[request.owner].identifierRevision;
	const [source] = await tx
		.select()
		.from(t)
		.where(
			and(
				eq(t.ownerId, request.sourceUnitId),
				eq(t.id, item.sourceIdentifierId),
				eq(t.revision, item.sourceIdentifierRevision),
			),
		)
		.limit(1);
	if (!source) throw new ReconciliationRequired("identifier_history_missing");
	const { target } = await sourceAndTarget(tx, request);
	const copied = await addCatalogIdentifier(
		tx,
		{ owner: request.owner, id: request.targetUnitId },
		op.executorAuthUserId,
		target.revision,
		{
			namespace: source.namespace,
			value: source.value,
			issuerEntityId: source.issuerEntityId,
			state: source.state,
		},
	);
	await resolveItem(tx, op, item, "copy_identifier_claim", {
		targetIdentifierId: copied.id,
		targetIdentifierRevision: copied.identifierRevision,
		targetOwnerRevision: copied.revision,
	});
}
async function moveBinding(
	tx: DatabaseTransaction,
	op: Op,
	request: RequestRow,
	item: Item,
	retain = false,
	reviewedBindingRevision?: number,
) {
	if (!item.sourceRecordId || !item.mappingKey || !item.sourceBindingRevision)
		throw new ReconciliationRequired("missing_binding_reference");
	const current = await lockCatalogSourceBinding(tx, {
		sourceRecordId: item.sourceRecordId,
		mappingKey: item.mappingKey,
	});
	const expectedRevision = reviewedBindingRevision ?? item.sourceBindingRevision;
	if (current.claim.bindingRevision !== expectedRevision)
		throw new ReconciliationRequired("binding_changed");
	if (current.reference.owner !== request.owner || current.reference.id !== request.sourceUnitId) {
		if (retain && reviewedBindingRevision !== undefined) {
			// The exact current binding revision retains its concrete target FKs. Do not move an independently rebound source.
			await resolveItem(tx, op, item, "retain_independently_rebound_binding", { targetBindingRevision: expectedRevision });
			return;
		}
		throw new ReconciliationRequired("binding_target_changed");
	}
	const [before] = await tx
		.select()
		.from(catalogSourceBindingRevision)
		.where(
			and(
				eq(catalogSourceBindingRevision.sourceRecordId, item.sourceRecordId),
				eq(catalogSourceBindingRevision.mappingKey, item.mappingKey),
				eq(catalogSourceBindingRevision.revision, expectedRevision),
			),
		)
		.limit(1);
	if (!before) throw new ReconciliationRequired("binding_history_missing");
	if (before.state === "withdrawn") {
		await resolveItem(tx, op, item, "retain_withdrawn_binding", {
			targetBindingRevision: before.revision,
		});
		return;
	}
	const plan = MergePlanSchema.parse(request.plan),
		rebind = !retain && plan.bindings === "rebind_paused";
	const changed = await reviseCatalogSourceBinding(tx, op.executorAuthUserId, {
		sourceRecordId: item.sourceRecordId,
		mappingKey: item.mappingKey,
		expectedRevision,
		state: "paused",
		mode: before.mode,
		reason: `Reviewed native merge ${request.id}: ${rebind ? "rebind paused" : "retain paused source"}`,
		...(rebind ? { target: { owner: request.owner, id: request.targetUnitId } } : {}),
	});
	await resolveItem(tx, op, item, rebind ? "rebind_paused" : "retain_paused_binding", {
		targetBindingRevision: changed.revision,
	});
}
async function safelyResolve(
	tx: DatabaseTransaction,
	_op: Op,
	item: Item,
	work: (nested: DatabaseTransaction) => Promise<unknown>,
) {
	if (!pending(item)) return;
	try {
		await tx.transaction(async (nested) => {
			await work(nested);
		});
	} catch (error) {
		const state = databaseSqlState(error);
		if (state && !["23514", "23503", "23505"].includes(state)) throw error;
		await actionRequired(
			tx,
			item,
			error instanceof ReconciliationRequired ? error.code : "native_reconciliation_validation",
		);
	}
}
async function processPage(
	tx: DatabaseTransaction,
	op: Op,
	request: RequestRow,
	authorization: Authorization<string>,
) {
	const plan = MergePlanSchema.parse(request.plan);
	if (op.phase === "canonicalize") {
		const manifest = await buildUnitMergeManifest(tx, authorization, {
			sourceUnitId: request.sourceUnitId,
			targetUnitId: request.targetUnitId,
			plan,
			operationId: op.id,
		});
		assertMergeManifestFingerprint(manifest, request.requestFingerprint);
		const table = CatalogIdentityTables[request.owner];
		const [source] = await tx
			.update(table)
			.set({
				status: "archived",
				revision: sql`${table.revision}+1`,
				updatedAt: nextUnitUpdatedAt(request.sourceUpdatedAt),
			})
			.where(and(eq(table.id, request.sourceUnitId), eq(table.revision, request.sourceRevision)))
			.returning({ revision: table.revision });
		if (!source) throw new ReconciliationRequired("source_revision_changed");
		await tx.insert(CatalogFactTables[request.owner].change).values({
			ownerId: request.sourceUnitId,
			version: source.revision,
			actorAuthUserId: op.executorAuthUserId,
			operation: "identity.merge.archive",
		});
		await tx.insert(unitMergeRedirect).values({
			sourceUnitId: request.sourceUnitId,
			targetUnitId: request.targetUnitId,
			owner: request.owner,
			requestId: request.id,
			sourceWasPublic:
				request.statusAtRequest === "published" && request.visibilityAtRequest !== "private",
		});
		await tx
			.update(unitMergeRequest)
			.set({ state: "executing", canonicalizedAt: new Date() })
			.where(eq(unitMergeRequest.id, request.id));
		return { done: true, processed: 1 };
	}
	if (op.phase === "names") {
		const t = CatalogNameTables[request.owner].name;
		const rows = await tx
			.select()
			.from(t)
			.where(
				and(
					eq(t.ownerId, request.sourceUnitId),
					eq(t.state, "active"),
					op.cursorId ? gt(t.id, op.cursorId) : undefined,
				),
			)
			.orderBy(t.id)
			.limit(UnitMergePolicy.workerBatchSize);
		for (const row of rows) {
			const item = await ensureItem(tx, op, request, {
				kind: "name",
				sourceKey: `current:${row.id}:${row.revision}`,
				sourceNameId: row.id,
				sourceNameRevision: row.revision,
			});
			await safelyResolve(tx, op, item, (nested) =>
				plan.names === "retain_source"
					? resolveItem(nested, op, item, "retain_name")
					: copyName(nested, op, request, item),
			);
		}
		return {
			done: rows.length < UnitMergePolicy.workerBatchSize,
			processed: rows.length,
			cursorId: rows.at(-1)?.id,
		};
	}
	if (op.phase === "identifiers") {
		const t = CatalogNameTables[request.owner].identifier;
		const rows = await tx
			.select()
			.from(t)
			.where(
				and(
					eq(t.ownerId, request.sourceUnitId),
					eq(t.state, "active"),
					op.cursorId ? gt(t.id, op.cursorId) : undefined,
				),
			)
			.orderBy(t.id)
			.limit(UnitMergePolicy.workerBatchSize);
		for (const row of rows) {
			const item = await ensureItem(tx, op, request, {
				kind: "identifier",
				sourceKey: `${row.id}:${row.revision}`,
				sourceIdentifierId: row.id,
				sourceIdentifierRevision: row.revision,
			});
			await safelyResolve(tx, op, item, (nested) =>
				plan.identifiers === "retain_source"
					? resolveItem(nested, op, item, "retain_identifier")
					: copyIdentifier(nested, op, request, item),
			);
		}
		return {
			done: rows.length < UnitMergePolicy.workerBatchSize,
			processed: rows.length,
			cursorId: rows.at(-1)?.id,
		};
	}
	if (op.phase === "semantics") {
		const { semanticHead: h, semanticRevision: r } = CatalogFactTables[request.owner];
		const rows = await tx
			.select({ id: h.semanticId, version: h.version, state: r.state })
			.from(h)
			.innerJoin(
				r,
				and(eq(r.ownerId, h.ownerId), eq(r.semanticId, h.semanticId), eq(r.version, h.version)),
			)
			.where(
				and(
					eq(h.ownerId, request.sourceUnitId),
					op.cursorId ? gt(h.semanticId, op.cursorId) : undefined,
				),
			)
			.orderBy(h.semanticId)
			.limit(UnitMergePolicy.inventoryBatchSize);
		for (const row of rows) {
			if (row.state !== "active") continue;
			const item = await ensureItem(tx, op, request, {
				kind: "semantic",
				sourceKey: `${row.id}:${row.version}`,
				sourceSemanticId: row.id,
				sourceSemanticVersion: row.version,
			});
			if (pending(item)) await resolveItem(tx, op, item, "retain_semantic_snapshot");
		}
		return {
			done: rows.length < UnitMergePolicy.inventoryBatchSize,
			processed: rows.length,
			cursorId: rows.at(-1)?.id,
		};
	}
	if (op.phase === "bindings") {
		const t = CatalogFactTables[request.owner].sourceBinding,
			c = catalogSourceMappingClaim;
		const rows = await tx
			.select({ id: t.mappingKey, sourceRecordId: t.sourceRecordId, revision: c.bindingRevision })
			.from(t)
			.innerJoin(c, and(eq(c.sourceRecordId, t.sourceRecordId), eq(c.mappingKey, t.mappingKey)))
			.where(
				and(
					eq(t.ownerId, request.sourceUnitId),
					op.cursorId
						? or(
								gt(t.mappingKey, op.cursorId),
								and(
									eq(t.mappingKey, op.cursorId),
									gt(
										t.sourceRecordId,
										op.cursorSecondaryId ?? "00000000-0000-0000-0000-000000000000",
									),
								),
							)
						: undefined,
				),
			)
			.orderBy(t.mappingKey, t.sourceRecordId)
			.limit(UnitMergePolicy.workerBatchSize);
		for (const row of rows) {
			const item = await ensureItem(tx, op, request, {
				kind: "source_binding",
				sourceKey: `${row.sourceRecordId}:${row.id}:${row.revision}`,
				sourceRecordId: row.sourceRecordId,
				mappingKey: row.id,
				sourceBindingRevision: row.revision,
			});
			await safelyResolve(tx, op, item, (nested) => moveBinding(nested, op, request, item));
		}
		return {
			done: rows.length < UnitMergePolicy.workerBatchSize,
			processed: rows.length,
			cursorId: rows.at(-1)?.id,
			cursorSecondaryId: rows.at(-1)?.sourceRecordId,
		};
	}
	if (op.phase === "structure") {
		const item = await ensureItem(tx, op, request, {
			kind: "structure",
			sourceKey: `root:${request.sourceUnitId}:${request.sourceRevision}`,
		});
		if (pending(item)) await resolveItem(tx, op, item, "retain_native_structure");
		return { done: true, processed: 1 };
	}
	if (op.phase === "settle") {
		const [remaining] = await tx
			.select({ id: unitMergeReconciliationItem.id })
			.from(unitMergeReconciliationItem)
			.where(
				and(
					eq(unitMergeReconciliationItem.requestId, request.id),
					inArray(unitMergeReconciliationItem.state, ["pending", "action_required"]),
				),
			)
			.limit(1);
		if (remaining) throw new ReconciliationRequired("items_need_review");
		return { done: true, processed: 0 };
	}
	await tx
		.update(unitMergeOperation)
		.set({ state: "completed", completedAt: new Date(), leaseToken: null, leaseExpiresAt: null })
		.where(eq(unitMergeOperation.id, op.id));
	await tx
		.update(unitMergeRequest)
		.set({ state: "completed", completedAt: new Date() })
		.where(eq(unitMergeRequest.id, request.id));
	await tx.delete(unitMergeGraphLock).where(eq(unitMergeGraphLock.operationId, op.id));
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "auth", authUserId: op.executorAuthUserId },
		authority: { kind: "platform" },
		action: "unit.merge.reconciled",
		target: { kind: "unit_merge_request", id: request.id },
		details: { sourceUnitId: request.sourceUnitId, targetUnitId: request.targetUnitId, plan },
	});
	return { done: true, processed: 0, completed: true };
}
export async function processClaimedUnitMergePage(claimed: Op) {
	return database.transaction(async (tx) => {
		const [request] = await tx
			.select()
			.from(unitMergeRequest)
			.where(eq(unitMergeRequest.id, claimed.requestId))
			.limit(1)
			.for("update");
		const [op] = await tx
			.select()
			.from(unitMergeOperation)
			.where(eq(unitMergeOperation.id, claimed.id))
			.limit(1)
			.for("update");
		if (
			!request ||
			!op ||
			op.state !== "processing" ||
			op.leaseToken !== claimed.leaseToken ||
			!op.leaseExpiresAt ||
			op.leaseExpiresAt <= new Date()
		)
			return { outcome: "lease_lost" as const };
		await tx.execute(
			sql`select set_config('lock_timeout','5000',true),set_config('statement_timeout','25000',true),set_config('rezics.merge_request_id',${request.id},true),set_config('rezics.merge_lease_token',${op.leaseToken},true)`,
		);
		const result = await admitted(tx, op, (authorization) =>
			processPage(tx, op, request, authorization),
		);
		if (!result.completed) {
			const phase = result.done ? nextUnitMergePhase(op.phase) : op.phase;
			if (!phase) throw new Error("Merge phase ended without finalization");
			await tx
				.update(unitMergeOperation)
				.set({
					phase,
					cursorId: result.done ? null : (result.cursorId ?? op.cursorId),
					cursorSecondaryId: result.done
						? null
						: (result.cursorSecondaryId ?? op.cursorSecondaryId),
					processedRows: sql`${unitMergeOperation.processedRows}+${result.processed}`,
					state: "pending",
					leaseToken: null,
					leaseExpiresAt: null,
					availableAt: new Date(),
					lastErrorCode: null,
					lastErrorMessage: null,
				})
				.where(eq(unitMergeOperation.id, op.id));
		}
		return { outcome: result.completed ? ("completed" as const) : ("continued" as const) };
	});
}
async function failClaim(claimed: Op, error: unknown) {
	return database.transaction(async (tx) => {
		const [request] = await tx
			.select()
			.from(unitMergeRequest)
			.where(eq(unitMergeRequest.id, claimed.requestId))
			.limit(1)
			.for("update");
		const [op] = await tx
			.select()
			.from(unitMergeOperation)
			.where(eq(unitMergeOperation.id, claimed.id))
			.limit(1)
			.for("update");
		if (!request || !op || op.state !== "processing" || op.leaseToken !== claimed.leaseToken)
			return;
		const stale = error instanceof Error && error.constructor.name === "UnitMergeManifestStale",
			manual =
				error instanceof ReconciliationRequired ||
				(error instanceof Error &&
					[
						"ParticipationDenied",
						"PlatformCapabilityRequired",
						"CatalogAccessDenied",
						"UnitPermissionForbidden",
					].includes(error.constructor.name));
		const attempts = op.attemptCount + 1,
			state = stale || attempts >= 12 ? "failed" : manual ? "action_required" : "retry_wait";
		await tx
			.update(unitMergeOperation)
			.set({
				state,
				attemptCount: attempts,
				leaseToken: null,
				leaseExpiresAt: null,
				lastErrorCode: stale
					? "manifest_changed"
					: manual
						? "reconciliation_required"
						: "merge_retry",
				lastErrorMessage:
					error instanceof ReconciliationRequired
						? error.code
						: "The merge needs operator attention or a retry.",
				availableAt: new Date(
					Date.now() + unitMergeRetryDelayMilliseconds(attempts, Math.random()),
				),
			})
			.where(eq(unitMergeOperation.id, op.id));
		await tx
			.update(unitMergeRequest)
			.set({ state: stale ? "superseded" : state === "retry_wait" ? "executing" : state })
			.where(eq(unitMergeRequest.id, request.id));
		if (stale && !request.canonicalizedAt)
			await tx.delete(unitMergeGraphLock).where(eq(unitMergeGraphLock.operationId, op.id));
	});
}
export async function dispatchUnitMergeBatch() {
	const claimed = await claimUnitMergeOperations(new Date());
	await Promise.all(
		claimed.map(async (op) => {
			try {
				await processClaimedUnitMergePage(op);
			} catch (error) {
				await failClaim(op, error);
			}
		}),
	);
	return claimed.length;
}
export async function resolveMergeReconciliationItem(
	authorization: Authorization<string>,
	requestId: string,
	itemId: string,
	input: { action: "retry" | "retain_source"; expectedTargetRevision: number; expectedBindingRevision?: number; reason: string },
) {
	return database.transaction(async (tx) => {
		await authorization.platform.ensureCapability("unit.merge", tx);
		const authority = await humanMergeAuthority(tx, authorization);
		const [request] = await tx
				.select()
				.from(unitMergeRequest)
				.where(eq(unitMergeRequest.id, requestId))
				.limit(1)
				.for("update"),
			[op] = await tx
				.select()
				.from(unitMergeOperation)
				.where(eq(unitMergeOperation.requestId, requestId))
				.limit(1)
				.for("update"),
			[item] = await tx
				.select()
				.from(unitMergeReconciliationItem)
				.where(
					and(
						eq(unitMergeReconciliationItem.requestId, requestId),
						eq(unitMergeReconciliationItem.id, itemId),
					),
				)
				.limit(1)
				.for("update");
		if (!request || !op || !item || op.state === "processing" || !pending(item))
			throw new ReconciliationRequired("item_unavailable");
		if (item.kind === "source_binding" && input.expectedBindingRevision === undefined)
			throw new ValidationError({ message: "Review the current source binding revision before resolving this item" });
		const target = await readUnitStateById(tx, request.targetUnitId, { lock: "update" });
		if (!target || target.revision !== input.expectedTargetRevision)
			throw new ReconciliationRequired("target_revision_changed");
		const operator = {
			...op,
			executorAuthUserId: authority.principal.authUserId,
			executorProfileId: authorization.profileId,
			executorAuthority: authority,
		};
		await tx.execute(sql`select set_config('rezics.merge_request_id',${requestId},true)`);
		await admitted(tx, operator, async () => {
			if (input.action === "retain_source") {
				if (item.kind === "source_binding") await moveBinding(tx, operator, request, item, true, input.expectedBindingRevision);
				else await resolveItem(tx, operator, item, "retain_reviewed_source");
			} else if (item.kind === "name")
				await copyName(tx, operator, request, item, 0, item.sourceKey.startsWith("anchor:"));
			else if (item.kind === "identifier") await copyIdentifier(tx, operator, request, item);
			else if (item.kind === "source_binding") await moveBinding(tx, operator, request, item, false, input.expectedBindingRevision);
			else await resolveItem(tx, operator, item, "retain_reviewed_source");
		});
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "auth", authUserId: authority.principal.authUserId },
			authority: { kind: "platform" },
			action: "unit.merge.reconciliation.resolve",
			target: { kind: "unit_merge_request", id: requestId },
			details: { itemId, action: input.action, reason: input.reason, expectedBindingRevision: input.expectedBindingRevision ?? null },
		});
		return { resolved: true as const };
	}).catch((cause: unknown) => {
		if (cause instanceof ReconciliationRequired) throw new CatalogRevisionConflict(`Merge reconciliation changed: ${cause.code}`);
		throw cause;
	});
}
