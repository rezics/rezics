import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	catalogSourceAdoptionProposal as proposals,
	catalogSourceMappingClaim as claims,
	catalogSourceSnapshot as snapshots,
	catalogSourceSubscription as subscriptions,
	catalogSourceObservationFanout as fanout,
} from "../database/schema/catalog-source";
import { type CatalogReference } from "./contracts";
import { loadCatalogIdentity } from "./storage";
import {
	type CatalogBindingKey,
	lockCatalogSourceBinding,
	appendSourceLifecycleEvent,
} from "./source-bindings";
import {
	recordCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import { catalogSourceApplication } from "../database/schema/catalog-source-application";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";

const proposalInputSchema = z.strictObject({
	sourceRecordId: z.uuid(),
	mappingKey: z.uuid(),
	snapshotId: z.uuid(),
	mappingVersion: z.string().min(1).max(128),
});

/** @internal Owner commands supply the actual native mutation; this protocol supplies authority and replay fences. */
export type CatalogSourceNativeWriter = (
	tx: DatabaseTransaction,
	context: {
		reference: CatalogReference;
		actor: string;
		expectedRevision: number;
		sourceRecordId: string;
		snapshotId: string;
		mappingVersion: string;
		mappingKey: string;
		proposalId: string;
		action: "apply" | "withdraw";
		previousSnapshotId: string | null;
	},
) => Promise<{ revision: number; changes?: CatalogSourceNativeChange[] }>;

/** @internal Bounded one-target proposal, pinned to exact binding, policy, snapshot and native revision. */
export async function proposeCatalogSourceAdoption(
	tx: DatabaseTransaction,
	actor: string,
	input: CatalogBindingKey & { snapshotId: string; mappingVersion: string },
) {
	const value = proposalInputSchema.parse(input);
	const current = await lockCatalogSourceBinding(tx, {
		sourceRecordId: value.sourceRecordId,
		mappingKey: value.mappingKey,
	});
	const native = await loadCatalogIdentity(tx, current.reference, actor, true);
	return writeCatalogSourceProposal(tx, current, value, native.revision, actor);
}

/** Enqueue from a committed source observation and its active subscription; no account is impersonated. @internal */
export async function enqueueCatalogSourceObservationProposal(
	tx: DatabaseTransaction,
	input: z.infer<typeof proposalInputSchema> & {
		expectedBindingRevision: number;
		afterMappingKey: string | null;
	},
) {
	const value = proposalInputSchema.parse({
		sourceRecordId: input.sourceRecordId,
		mappingKey: input.mappingKey,
		snapshotId: input.snapshotId,
		mappingVersion: input.mappingVersion,
	});
	z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(input.expectedBindingRevision);
	if (input.afterMappingKey !== null) z.uuid().parse(input.afterMappingKey);
	const current = await lockCatalogSourceBinding(tx, {
		sourceRecordId: value.sourceRecordId,
		mappingKey: value.mappingKey,
	});
	const [continuation] = await tx
		.select()
		.from(fanout)
		.where(
			and(eq(fanout.sourceRecordId, value.sourceRecordId), eq(fanout.snapshotId, value.snapshotId)),
		)
		.limit(1);
	const [subscription] = await tx
		.select()
		.from(subscriptions)
		.where(
			and(
				eq(subscriptions.sourceRecordId, value.sourceRecordId),
				eq(subscriptions.mappingKey, value.mappingKey),
			),
		)
		.limit(1);
	if (
		!continuation ||
		continuation.completedAt ||
		continuation.afterMappingKey !== input.afterMappingKey ||
		!subscription ||
		subscription.revision !== input.expectedBindingRevision ||
		current.claim.bindingRevision !== input.expectedBindingRevision ||
		subscription.owner !== current.reference.owner
	)
		throw new Error(
			"Source observation proposal requires its exact active fan-out and subscription fence",
		);
	if (subscription.state !== "active") return { status: "paused" as const };
	const identity = CatalogIdentityTables[current.reference.owner];
	const [native] = await tx
		.select({ revision: identity.revision })
		.from(identity)
		.where(and(eq(identity.id, current.reference.id), isNull(identity.deletedAt)))
		.limit(1)
		.for("update");
	if (!native) throw new Error("Source observation target is unavailable");
	return writeCatalogSourceProposal(tx, current, value, native.revision, null);
}

async function writeCatalogSourceProposal(
	tx: DatabaseTransaction,
	current: Awaited<ReturnType<typeof lockCatalogSourceBinding>>,
	value: z.infer<typeof proposalInputSchema>,
	expectedTargetRevision: number,
	proposerAuthUserId: string | null,
) {
	if (current.claim.state !== "active") return { status: "paused" as const };
	if (value.mappingVersion !== current.claim.mappingVersion)
		throw new Error("Source mapping protocol requires an explicit binding revision");
	if (current.source.headSnapshotId !== value.snapshotId)
		throw new Error("Proposal observation is no longer current");
	const [snapshot] = await tx
		.select()
		.from(snapshots)
		.where(
			and(eq(snapshots.sourceRecordId, value.sourceRecordId), eq(snapshots.id, value.snapshotId)),
		)
		.limit(1);
	if (!snapshot) throw new Error("Proposal snapshot is missing");
	if (current.claim.observedSnapshotId === snapshot.id) return { status: "unchanged" as const };
	const values = {
		...value,
		mappingOwner: current.claim.owner,
		expectedTargetRevision,
		expectedBindingRevision: current.claim.bindingRevision,
		expectedPolicyRevision: current.claim.policyRevision,
		proposerAuthUserId,
	};
	await tx.insert(proposals).values(values).onConflictDoNothing();
	const [proposal] = await tx
		.select()
		.from(proposals)
		.where(
			and(
				eq(proposals.sourceRecordId, value.sourceRecordId),
				eq(proposals.snapshotId, value.snapshotId),
				eq(proposals.mappingKey, value.mappingKey),
				eq(proposals.mappingVersion, value.mappingVersion),
				eq(proposals.expectedBindingRevision, current.claim.bindingRevision),
				eq(proposals.expectedPolicyRevision, current.claim.policyRevision),
				eq(proposals.expectedTargetRevision, expectedTargetRevision),
			),
		)
		.limit(1);
	if (!proposal) throw new Error("Source proposal insertion failed");
	return { status: "proposed" as const, proposal };
}

/** @internal Apply/reject/supersede/withdraw never accept an approval for another mapping version. */
export async function decideCatalogSourceProposal(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		sourceRecordId: string;
		proposalId: string;
		mappingVersion: string;
		action: "apply" | "reject" | "supersede" | "withdraw";
		reason: string;
	},
	nativeWriter?: CatalogSourceNativeWriter,
) {
	const value = z
		.strictObject({
			sourceRecordId: z.uuid(),
			proposalId: z.uuid(),
			mappingVersion: z.string().min(1).max(128),
			action: z.enum(["apply", "reject", "supersede", "withdraw"]),
			reason: z.string().min(1).max(2048),
		})
		.parse(input);
	const key = and(
		eq(proposals.sourceRecordId, value.sourceRecordId),
		eq(proposals.id, value.proposalId),
	);
	// Read locator without authority, then acquire the common source -> mapping -> proposal order.
	const [locator] = await tx
		.select({ mappingKey: proposals.mappingKey })
		.from(proposals)
		.where(key)
		.limit(1);
	if (!locator) throw new Error("Source proposal does not exist");
	const current = await lockCatalogSourceBinding(tx, {
		sourceRecordId: value.sourceRecordId,
		mappingKey: locator.mappingKey,
	});
	const [proposal] = await tx.select().from(proposals).where(key).limit(1).for("update");
	if (!proposal || proposal.mappingVersion !== value.mappingVersion)
		throw new Error("Source proposal mapping version differs");
	const native = await loadCatalogIdentity(tx, current.reference, actor, true);
	const targetState = {
		apply: "applied",
		reject: "rejected",
		supersede: "superseded",
		withdraw: "withdrawn",
	} as const;
	if (proposal.state === targetState[value.action])
		return { status: "repeated" as const, proposal };
	if (value.action === "withdraw" ? proposal.state !== "applied" : proposal.state !== "pending")
		throw new Error("Source proposal transition is not allowed");
	const fenceMatches =
		proposal.expectedBindingRevision === current.claim.bindingRevision &&
		proposal.expectedPolicyRevision === current.claim.policyRevision;
	const revisionMatches =
		native.revision ===
		(value.action === "withdraw"
			? proposal.appliedTargetRevision
			: proposal.expectedTargetRevision);
	if (
		value.action === "apply" &&
		(!fenceMatches ||
			proposal.mappingVersion !== current.claim.mappingVersion ||
			!revisionMatches ||
			current.claim.state !== "active" ||
			current.source.headSnapshotId !== proposal.snapshotId ||
			current.source.lastCheckOutcome === "tombstone")
	) {
		await tx
			.update(proposals)
			.set({
				state: "superseded",
				decidedAt: new Date(),
				decisionReason: "Source, binding, policy or native revision changed",
			})
			.where(key);
		await appendSourceLifecycleEvent(
			tx,
			value.sourceRecordId,
			"source.adoption.decided",
			current.claim.bindingRevision,
			{ proposalId: proposal.id, state: "superseded" },
		);
		return { status: "superseded" as const };
	}
	if (value.action === "withdraw" && (!fenceMatches || !revisionMatches))
		throw new Error("Withdrawal would overwrite independent native edits or a rebound target");
	let appliedTargetRevision = proposal.appliedTargetRevision;
	if (value.action === "apply" || value.action === "withdraw") {
		if (!nativeWriter) throw new Error("Source decision requires its canonical native command");
		const [priorApplication] =
			value.action === "withdraw"
				? await tx
						.select()
						.from(catalogSourceApplication)
						.where(
							and(
								eq(catalogSourceApplication.sourceRecordId, value.sourceRecordId),
								eq(catalogSourceApplication.proposalId, proposal.id),
								eq(catalogSourceApplication.action, "apply"),
							),
						)
						.limit(1)
				: [];
		if (value.action === "withdraw" && !priorApplication)
			throw new Error("Withdrawal requires the exact prior native application");
		const result = await nativeWriter(tx, {
			reference: current.reference,
			actor,
			expectedRevision: native.revision,
			sourceRecordId: value.sourceRecordId,
			snapshotId: proposal.snapshotId,
			mappingVersion: proposal.mappingVersion,
			mappingKey: proposal.mappingKey,
			proposalId: proposal.id,
			action: value.action,
			previousSnapshotId: current.claim.observedSnapshotId,
		});
		z.number()
			.int()
			.min(native.revision + 1)
			.max(Number.MAX_SAFE_INTEGER)
			.parse(result.revision);
		const after = await loadCatalogIdentity(tx, current.reference, actor, true);
		if (after.revision !== result.revision)
			throw new Error("Native source command did not commit its declared revision");
		await recordCatalogSourceApplication(
			tx,
			{
				sourceRecordId: value.sourceRecordId,
				proposalId: proposal.id,
				action: value.action,
				previousSnapshotId: current.claim.observedSnapshotId,
				previousEvidenceSourceRecordId: current.claim.evidenceSourceRecordId,
				previousEvidenceSnapshotId: current.claim.evidenceSnapshotId,
				previousEvidencePath: current.claim.evidencePath,
				beforeRevision: native.revision,
				afterRevision: result.revision,
			},
			result.changes ?? [],
		);
		appliedTargetRevision = result.revision;
		if (value.action === "apply")
			await tx
				.update(claims)
				.set({
					observedSnapshotId: proposal.snapshotId,
					evidenceSourceRecordId: null,
					evidenceSnapshotId: null,
					evidencePath: null,
				})
				.where(
					and(
						eq(claims.sourceRecordId, value.sourceRecordId),
						eq(claims.mappingKey, proposal.mappingKey),
					),
				);
		else if (priorApplication)
			await tx
				.update(claims)
				.set({
					observedSnapshotId: priorApplication.previousSnapshotId,
					evidenceSourceRecordId: priorApplication.previousEvidenceSourceRecordId,
					evidenceSnapshotId: priorApplication.previousEvidenceSnapshotId,
					evidencePath: priorApplication.previousEvidencePath,
				})
				.where(
					and(
						eq(claims.sourceRecordId, value.sourceRecordId),
						eq(claims.mappingKey, proposal.mappingKey),
					),
				);
	}
	const [decided] = await tx
		.update(proposals)
		.set({
			state: targetState[value.action],
			decidedAt: new Date(),
			decisionReason: value.reason,
			appliedTargetRevision,
		})
		.where(key)
		.returning();
	await appendSourceLifecycleEvent(
		tx,
		value.sourceRecordId,
		"source.adoption.decided",
		current.claim.bindingRevision,
		{ proposalId: proposal.id, state: targetState[value.action], snapshotId: proposal.snapshotId },
	);
	return { status: targetState[value.action], proposal: decided };
}

/** @internal Scoped review page uses source-record partition pruning and a keyset cursor. */
export async function listCatalogSourceProposals(
	tx: DatabaseTransaction,
	actor: string,
	key: CatalogBindingKey,
	afterId?: string,
	limit = 50,
) {
	z.number().int().min(1).max(100).parse(limit);
	if (afterId) z.uuid().parse(afterId);
	const binding = await lockCatalogSourceBinding(tx, key);
	await loadCatalogIdentity(tx, binding.reference, actor, false);
	return tx
		.select()
		.from(proposals)
		.where(
			and(
				eq(proposals.sourceRecordId, key.sourceRecordId),
				eq(proposals.mappingKey, key.mappingKey),
				afterId ? gt(proposals.id, afterId) : undefined,
			),
		)
		.orderBy(proposals.id)
		.limit(limit);
}
