import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { database, withDatabaseTransactionDeadline, type DatabaseTransaction } from "../database";
import { contentGovernanceAction, contentReport, contentReportReferral, contentReviewCase,
	governanceNoticeRecipient, governanceReportDelivery } from "../database/schema";
import { createNotification, resolveNotificationRecipients } from "../notifications/service";

/** @internal Fixed work bounds; queue ownership is a PostgreSQL row lock held through each page. */
export const GovernanceReportDeliveryPolicy = { shards: 64, pageSize: 32, concurrentPages: 4, transactionMs: 20_000 } as const;

/** @internal The action and its exact referral prefix are committed together. */
export async function enqueueGovernanceReportDelivery(tx: DatabaseTransaction, input: {
	caseId: string; actorEntityId: string; actorAuthUserId: string; publicNoticePostId?: string;
} & ({ kind: "action"; actionId: string } | { kind: "dismissal" | "notice"; actionId?: never })) {
	await tx.select({ id: contentReviewCase.id }).from(contentReviewCase)
		.where(eq(contentReviewCase.id, input.caseId)).limit(1).for("update");
	const [boundary] = await tx.select({ id: contentReportReferral.id }).from(contentReportReferral)
		.where(eq(contentReportReferral.caseId, input.caseId)).orderBy(desc(contentReportReferral.id)).limit(1);
	if (!boundary) return;
	const id = randomUUID();
	await tx.insert(governanceReportDelivery).values({
		...input, id, shard: Number.parseInt(id.slice(0, 2), 16) % GovernanceReportDeliveryPolicy.shards,
		throughReferralId: boundary.id,
	}).onConflictDoNothing();
}

/** @internal Exactly one bounded page; notification, read receipt and cursor advance share the transaction. */
export async function processGovernanceReportDeliveryPage(tx: DatabaseTransaction,
	claimed: Pick<typeof governanceReportDelivery.$inferSelect, "id">) {
	const [job] = await tx.select().from(governanceReportDelivery)
		.where(eq(governanceReportDelivery.id, claimed.id)).limit(1).for("update");
	if (!job || job.completedAt) return 0;
	const [caseRow] = await tx.select({ targetUnitId: contentReviewCase.targetUnitId }).from(contentReviewCase)
		.where(eq(contentReviewCase.id, job.caseId)).limit(1);
	if (!caseRow) throw new Error("Governance delivery case is missing");
	const [action] = job.actionId ? await tx.select({ kind: contentGovernanceAction.kind })
		.from(contentGovernanceAction).where(eq(contentGovernanceAction.id, job.actionId)).limit(1) : [];
	if (job.kind === "action" && !action) throw new Error("Governance delivery action is missing");
	const rows = await tx.select({ referralId: contentReportReferral.id, reportId: contentReport.id,
		reporterEntityId: contentReport.reporterProfileId }).from(contentReportReferral)
		.innerJoin(contentReport, eq(contentReport.id, contentReportReferral.reportId))
		.where(and(eq(contentReportReferral.caseId, job.caseId),
			lte(contentReportReferral.id, job.throughReferralId),
			job.afterReferralId ? gt(contentReportReferral.id, job.afterReferralId) : undefined))
		.orderBy(contentReportReferral.id).limit(GovernanceReportDeliveryPolicy.pageSize);
	for (const row of rows) {
		if (job.kind === "notice") {
			if (!job.publicNoticePostId) throw new Error("Notice delivery has no notice");
			const recipients = await resolveNotificationRecipients(tx, { recipientEntityId: row.reporterEntityId });
			if (recipients.length) await tx.insert(governanceNoticeRecipient).values(recipients.map(recipient => ({
				postId: job.publicNoticePostId!, authUserId: recipient.id,
			}))).onConflictDoNothing();
			continue;
		}
		await createNotification(tx, {
			recipientEntityId: row.reporterEntityId, actorProfileId: job.actorEntityId,
			kind: "moderation", subjectUnitId: caseRow.targetUnitId,
			dedupeKey: `governance-report:${job.id}:${row.referralId}`,
			payload: {
				type: "report_resolution", reportId: row.reportId, referralId: row.referralId,
				...(job.kind === "action" && action && job.actionId ? { actionId: job.actionId, actionKind: action.kind } : { resolution: "dismissed" as const }),
				...(job.publicNoticePostId ? { publicNoticePostId: job.publicNoticePostId } : {}),
			},
		});
	}
	await tx.update(governanceReportDelivery).set({
		afterReferralId: rows.at(-1)?.referralId ?? job.afterReferralId,
		completedAt: rows.length < GovernanceReportDeliveryPolicy.pageSize || rows.at(-1)?.referralId === job.throughReferralId ? new Date() : null,
		availableAt: new Date(), lastError: null,
	}).where(eq(governanceReportDelivery.id, job.id));
	return rows.length;
}

let nextShard = 0;
/** @internal Independent indexed shard probes; failed jobs back off without dropping any recipient. */
export async function dispatchGovernanceReportDelivery(shards?: readonly number[]) {
	const selected = shards ?? Array.from({ length: GovernanceReportDeliveryPolicy.concurrentPages }, () => {
		const shard = nextShard; nextShard = (nextShard + 1) % GovernanceReportDeliveryPolicy.shards; return shard;
	});
	if (selected.length > 4 || selected.some(shard => !Number.isInteger(shard) || shard < 0 || shard >= 64))
		throw new RangeError("Invalid governance delivery shard selection");
	return Promise.all([...new Set(selected)].map(async shard => {
		let claimed: { id: string; afterReferralId: string | null } | undefined;
		try {
			return await withDatabaseTransactionDeadline(GovernanceReportDeliveryPolicy.transactionMs, () => database.transaction(async tx => {
				const [job] = await tx.select().from(governanceReportDelivery).where(and(
					eq(governanceReportDelivery.shard, shard), isNull(governanceReportDelivery.completedAt),
					lte(governanceReportDelivery.availableAt, new Date()),
				)).orderBy(governanceReportDelivery.availableAt, governanceReportDelivery.id)
					.limit(1).for("update", { skipLocked: true });
				if (!job) return 0;
				claimed = { id: job.id, afterReferralId: job.afterReferralId };
				return processGovernanceReportDeliveryPage(tx, job);
			}));
		} catch (error) {
			if (claimed) await database.update(governanceReportDelivery).set({
				failureCount: sql`${governanceReportDelivery.failureCount}+1`,
				availableAt: sql`clock_timestamp() + least(300, 5 * (1 + ${governanceReportDelivery.failureCount})) * interval '1 second'`,
				lastError: error instanceof Error ? error.name.slice(0, 100) : "delivery_failed",
			}).where(and(eq(governanceReportDelivery.id, claimed.id), isNull(governanceReportDelivery.completedAt),
				sql`${governanceReportDelivery.afterReferralId} is not distinct from ${claimed.afterReferralId}::uuid`));
			throw error;
		}
	}));
}

/** @internal Receipt and action history outlive bounded operational jobs. */
export async function purgeCompletedGovernanceReportDeliveries(now = new Date()) {
	return database.transaction(async tx => {
		const rows = await tx.select({ id: governanceReportDelivery.id }).from(governanceReportDelivery)
			.where(lte(governanceReportDelivery.completedAt, new Date(now.getTime() - 86_400_000)))
			.orderBy(governanceReportDelivery.completedAt, governanceReportDelivery.id)
			.limit(128).for("update", { skipLocked: true });
		if (rows.length) await tx.delete(governanceReportDelivery)
			.where(sql`${governanceReportDelivery.id} = any(${rows.map(row => row.id)}::uuid[])`);
		return rows.length;
	});
}
