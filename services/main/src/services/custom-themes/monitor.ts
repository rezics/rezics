import { createHash } from "node:crypto";

import { and, asc, eq, isNull, lt, lte, or } from "drizzle-orm";

import { database } from "../database";
import { env } from "../config";
import {
	customThemeRevision,
	customThemeRevisionExternalResource,
	customThemeRevisionReviewEvent,
} from "../database/schema";
import { canonicalRevisionJson } from "../history/content";
import { fetchReviewedExternalResource } from "./external-resources";

// A maximally skewed 32-row batch runs as 16 two-request origin-limited waves.
const MonitorLeaseMilliseconds = 5 * 60_000;
const UnpinnedCheckIntervalMilliseconds = 5 * 60_000;
const PinnedCheckIntervalMilliseconds = 24 * 60 * 60_000;
const MaximumMonitorBatchSize = 32;
const MaximumPerOriginConcurrency = 2;

type ResourceRow = typeof customThemeRevisionExternalResource.$inferSelect;

async function claimMonitorBatch(limit: number) {
	return database.transaction(async (tx) => {
		const now = new Date();
		const rows = await tx
			.select()
			.from(customThemeRevisionExternalResource)
			.where(
				and(
					lte(customThemeRevisionExternalResource.nextCheckAt, now),
					or(
						isNull(customThemeRevisionExternalResource.monitorLeaseUntil),
						lt(customThemeRevisionExternalResource.monitorLeaseUntil, now),
					),
				),
			)
			.orderBy(
				asc(customThemeRevisionExternalResource.nextCheckAt),
				asc(customThemeRevisionExternalResource.revisionId),
				asc(customThemeRevisionExternalResource.resourceKey),
			)
			.limit(Math.max(1, Math.min(limit, MaximumMonitorBatchSize)))
			.for("update", { skipLocked: true });
		const leaseUntil = new Date(now.getTime() + MonitorLeaseMilliseconds);
		for (const row of rows)
			await tx
				.update(customThemeRevisionExternalResource)
				.set({ monitorLeaseUntil: leaseUntil })
				.where(
					and(
						eq(customThemeRevisionExternalResource.revisionId, row.revisionId),
						eq(customThemeRevisionExternalResource.resourceKey, row.resourceKey),
					),
				);
		return rows.map((row) => ({ ...row, monitorLeaseUntil: leaseUntil }));
	});
}

function sameObservation(
	row: ResourceRow,
	next: Awaited<ReturnType<typeof fetchReviewedExternalResource>>,
) {
	const previousRedirectChain = Array.isArray(row.reviewEvidence.redirectChain)
		? row.reviewEvidence.redirectChain.filter((value): value is string => typeof value === "string")
		: [];
	return (
		row.finalUrl === next.finalUrl &&
		row.observedSha256 === next.observedSha256 &&
		row.observedContentType === next.observedContentType &&
		row.corsAllowsAnonymous === next.corsAllowsAnonymous &&
		previousRedirectChain.length === next.redirectChain.length &&
		previousRedirectChain.every((url, index) => url === next.redirectChain[index])
	);
}

async function recordMonitorResult(
	row: ResourceRow,
	result:
		| { readonly kind: "current"; readonly checkedAt: Date }
		| {
				readonly kind: "drifted";
				readonly checkedAt: Date;
				readonly observation: Awaited<ReturnType<typeof fetchReviewedExternalResource>>;
		  }
		| { readonly kind: "unavailable"; readonly checkedAt: Date; readonly message: string },
): Promise<void> {
	await database.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(customThemeRevisionExternalResource)
			.where(
				and(
					eq(customThemeRevisionExternalResource.revisionId, row.revisionId),
					eq(customThemeRevisionExternalResource.resourceKey, row.resourceKey),
				),
			)
			.limit(1)
			.for("update");
		if (
			!current?.monitorLeaseUntil ||
			current.monitorLeaseUntil.getTime() !== row.monitorLeaseUntil?.getTime()
		)
			return;
		const failureCount = result.kind === "unavailable" ? current.monitorFailureCount + 1 : 0;
		const interval = current.integrityMetadata
			? PinnedCheckIntervalMilliseconds
			: UnpinnedCheckIntervalMilliseconds;
		const backoff =
			result.kind === "unavailable"
				? Math.min(interval * 2 ** Math.min(failureCount, 4), 60 * 60_000)
				: interval;
		const monitorEvidence =
			result.kind === "drifted"
				? {
						kind: result.kind,
						checkedAt: result.checkedAt.toISOString(),
						previous: {
							finalUrl: current.finalUrl,
							redirectChain: Array.isArray(current.reviewEvidence.redirectChain)
								? current.reviewEvidence.redirectChain
								: [],
							sha256: current.observedSha256,
							contentType: current.observedContentType,
							corsAllowsAnonymous: current.corsAllowsAnonymous,
						},
						next: {
							finalUrl: result.observation.finalUrl,
							redirectChain: [...result.observation.redirectChain],
							sha256: result.observation.observedSha256,
							contentType: result.observation.observedContentType,
							corsAllowsAnonymous: result.observation.corsAllowsAnonymous,
						},
					}
				: result.kind === "unavailable"
					? {
							kind: result.kind,
							checkedAt: result.checkedAt.toISOString(),
							message: result.message.slice(0, 1_000),
						}
					: { kind: result.kind, checkedAt: result.checkedAt.toISOString() };
		await tx
			.update(customThemeRevisionExternalResource)
			.set({
				currentHealthState: result.kind,
				lastCheckedAt: result.checkedAt,
				nextCheckAt: new Date(result.checkedAt.getTime() + backoff),
				monitorLeaseUntil: null,
				monitorFailureCount: failureCount,
				reviewEvidence: { ...current.reviewEvidence, lastMonitor: monitorEvidence },
			})
			.where(
				and(
					eq(customThemeRevisionExternalResource.revisionId, row.revisionId),
					eq(customThemeRevisionExternalResource.resourceKey, row.resourceKey),
				),
			);
		if (result.kind === "current") return;
		const requiresRevalidation =
			result.kind === "drifted" || current.reviewEvidence.required !== false;
		if (!requiresRevalidation) return;
		const [revision] = await tx
			.select({ state: customThemeRevision.reviewState })
			.from(customThemeRevision)
			.where(eq(customThemeRevision.id, row.revisionId))
			.limit(1)
			.for("update");
		if (revision?.state === "approved")
			await tx
				.update(customThemeRevision)
				.set({
					reviewState: "revalidation_required",
					nextAutomatedReviewAt: result.checkedAt,
					automatedReviewLeaseUntil: null,
				})
				.where(eq(customThemeRevision.id, row.revisionId));
		const evidenceSha256 = createHash("sha256")
			.update(canonicalRevisionJson(monitorEvidence))
			.digest("hex");
		await tx.insert(customThemeRevisionReviewEvent).values({
			revisionId: row.revisionId,
			kind: "revalidation",
			actorProfileId: null,
			evidence: monitorEvidence,
			evidenceSha256,
		});
	});
}

async function monitorResource(row: ResourceRow): Promise<"current" | "drifted" | "unavailable"> {
	const checkedAt = new Date();
	try {
		const observation = await fetchReviewedExternalResource(row.requestedUrl, {
			role: row.role,
			integrity: row.integrityMetadata,
			integrityWaiverReason: row.integrityWaiverReason,
			allowedCorsOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
			verifyIntegrity: false,
		});
		const kind = sameObservation(row, observation) ? "current" : "drifted";
		await recordMonitorResult(
			row,
			kind === "current" ? { kind, checkedAt } : { kind, checkedAt, observation },
		);
		return kind;
	} catch (error) {
		await recordMonitorResult(row, {
			kind: "unavailable",
			checkedAt,
			message: error instanceof Error ? error.message : String(error),
		});
		return "unavailable";
	}
}

export interface CustomThemeMonitorBatchResult {
	readonly checked: number;
	readonly drifted: number;
	readonly unavailable: number;
	readonly oldestQueueAgeMilliseconds: number;
}

export async function monitorCustomThemeExternalResourceBatch(
	limit = MaximumMonitorBatchSize,
): Promise<CustomThemeMonitorBatchResult> {
	const rows = await claimMonitorBatch(limit);
	const oldestQueueAgeMilliseconds = rows.length
		? Math.max(0, Date.now() - (rows[0]?.nextCheckAt.getTime() ?? Date.now()))
		: 0;
	const pending = [...rows];
	const outcomes: ("current" | "drifted" | "unavailable")[] = [];
	while (pending.length) {
		const originCounts = new Map<string, number>();
		const batch: ResourceRow[] = [];
		for (let index = 0; index < pending.length; ) {
			const row = pending[index] as ResourceRow;
			const count = originCounts.get(row.origin) ?? 0;
			if (count >= MaximumPerOriginConcurrency) {
				index += 1;
				continue;
			}
			batch.push(row);
			originCounts.set(row.origin, count + 1);
			pending.splice(index, 1);
		}
		outcomes.push(...(await Promise.all(batch.map(monitorResource))));
	}
	return {
		checked: outcomes.length,
		drifted: outcomes.filter((outcome) => outcome === "drifted").length,
		unavailable: outcomes.filter((outcome) => outcome === "unavailable").length,
		oldestQueueAgeMilliseconds,
	};
}
