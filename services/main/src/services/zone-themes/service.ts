import type { AvatarReference } from "@rezics/avatar";
import {
	ZoneStylingContract,
	type PortableTextDocument,
	type ZoneCustomThemeReference,
} from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq, gt, inArray, isNotNull, isNull, ne, notExists, or } from "drizzle-orm";

import { createProfileOwnedUnitAccess } from "../authorization/unit/ownership";
import { database, type DatabaseTransaction } from "../database";
import {
	imageAsset,
	unit,
	unitLocalization,
	zoneTheme,
	zoneThemeRevision,
	zoneThemeRevisionAsset,
	type StoredZoneThemeAiReview,
	type StoredZoneThemeAutomatedReview,
	type StoredZoneThemeRenderReview,
} from "../database/schema";
import { insertUnit } from "../units/create";
import { toUnitLocalizationStorage } from "../units/localization";
import { ensureImageAssetsAttachable } from "../api/image-assets/service";
import {
	ZoneThemeAssetsInvalid,
	ZoneThemeAutomatedReviewInvalid,
	ZoneThemeNotFound,
	ZoneThemeReferenceInvalid,
	ZoneThemeRevisionNotFound,
	ZoneThemeRevisionStateConflict,
	ZoneThemeStylesheetInvalid,
} from "../api/zone-themes/errors";
import {
	ZoneThemeReferenceBreakpoints,
	ZoneThemeReferenceColorSchemes,
} from "../api/zone-themes/schema";
import {
	reviewZoneThemeStylesheet,
	type ZoneThemeAutomatedReview,
	ZoneThemeStylesheetRejected,
} from "./stylesheet";

export interface ZoneThemeLocalizationInput {
	readonly language: ContentLanguage;
	readonly title: string;
	readonly summary?: string;
	readonly description?: PortableTextDocument;
	readonly avatar?: AvatarReference | null;
	readonly bannerAssetId?: string | null;
	readonly coverAssetId?: string | null;
}

export function presentZoneThemeRevision(row: typeof zoneThemeRevision.$inferSelect) {
	return {
		id: row.id,
		themeUnitId: row.themeUnitId,
		contractVersion: row.contractVersion,
		sha256: row.sha256,
		state: row.state,
		automatedReview: { ...row.automatedReview },
		renderReview: row.renderReview
			? { captures: row.renderReview.captures.map((capture) => ({ ...capture })) }
			: null,
		aiReview: row.aiReview ? { ...row.aiReview, findings: [...row.aiReview.findings] } : null,
		decisionReason: row.decisionReason,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toStoredAutomatedReview(review: ZoneThemeAutomatedReview): StoredZoneThemeAutomatedReview {
	return {
		contractVersion: review.contractVersion,
		declarationCount: review.declarationCount,
		minifiedBytes: review.minifiedBytes,
		ruleCount: review.ruleCount,
		selectorCount: review.selectorCount,
	};
}

async function ensureThemeExists(tx: DatabaseTransaction, themeUnitId: string): Promise<void> {
	const [theme] = await tx
		.select({ id: zoneTheme.id })
		.from(zoneTheme)
		.innerJoin(unit, and(eq(unit.id, zoneTheme.id), eq(unit.kind, "zone_theme")))
		.where(and(eq(zoneTheme.id, themeUnitId), isNull(unit.deletedAt)))
		.limit(1);
	if (!theme) throw new ZoneThemeNotFound();
}

export async function ensureZoneThemeExists(themeUnitId: string): Promise<void> {
	await database.transaction((tx) => ensureThemeExists(tx, themeUnitId));
}

export async function createZoneTheme(input: {
	readonly ownerProfileId: string;
	readonly localization: ZoneThemeLocalizationInput;
}) {
	return database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(tx, input.ownerProfileId, [
			{ assetId: input.localization.bannerAssetId, role: "banner" },
			{ assetId: input.localization.coverAssetId, role: "cover" },
		]);
		const created = await insertUnit(tx, {
			kind: "zone_theme",
			status: "published",
			visibility: "public",
			publishedAt: new Date(),
			statusActor: { kind: "profile", profileId: input.ownerProfileId },
		});
		await tx.insert(zoneTheme).values({ id: created.id });
		await tx
			.insert(unitLocalization)
			.values({ unitId: created.id, ...toUnitLocalizationStorage(input.localization) });
		await createProfileOwnedUnitAccess(tx, created.id, input.ownerProfileId);
		return {
			id: created.id,
			language: input.localization.language,
			title: input.localization.title,
			createdAt: created.createdAt,
			updatedAt: created.updatedAt,
		};
	});
}

async function ensureRevisionAssets(
	tx: DatabaseTransaction,
	profileId: string,
	assetIds: readonly string[],
): Promise<void> {
	if (!assetIds.length) return;
	const rows = await tx
		.select({ id: imageAsset.id })
		.from(imageAsset)
		.where(
			and(
				inArray(imageAsset.id, assetIds),
				eq(imageAsset.ownerProfileId, profileId),
				eq(imageAsset.status, "ready"),
				eq(imageAsset.access, "public"),
				isNull(imageAsset.deletedAt),
			),
		);
	if (rows.length !== assetIds.length) throw new ZoneThemeAssetsInvalid();
}

async function ensureBoundRevisionAssetsReadyAndPublic(
	tx: DatabaseTransaction,
	revisionId: string,
): Promise<void> {
	const [invalidAsset] = await tx
		.select({ id: zoneThemeRevisionAsset.assetId })
		.from(zoneThemeRevisionAsset)
		.innerJoin(imageAsset, eq(imageAsset.id, zoneThemeRevisionAsset.assetId))
		.where(
			and(
				eq(zoneThemeRevisionAsset.revisionId, revisionId),
				or(
					ne(imageAsset.status, "ready"),
					ne(imageAsset.access, "public"),
					isNotNull(imageAsset.deletedAt),
				),
			),
		)
		.limit(1);
	if (invalidAsset) throw new ZoneThemeAssetsInvalid();
}

async function ensureRenderEvidenceAssetsReady(
	tx: DatabaseTransaction,
	review: StoredZoneThemeRenderReview,
): Promise<void> {
	const assetIds = review.captures.map(({ screenshotAssetId }) => screenshotAssetId);
	const rows = await tx
		.select({ id: imageAsset.id })
		.from(imageAsset)
		.where(
			and(
				inArray(imageAsset.id, assetIds),
				eq(imageAsset.status, "ready"),
				isNull(imageAsset.deletedAt),
			),
		);
	if (rows.length !== assetIds.length) throw new ZoneThemeAutomatedReviewInvalid();
}

export async function submitZoneThemeRevision(input: {
	readonly assetIds: readonly string[];
	readonly css: string;
	readonly profileId: string;
	readonly themeUnitId: string;
}) {
	let reviewed: ReturnType<typeof reviewZoneThemeStylesheet>;
	try {
		reviewed = reviewZoneThemeStylesheet({ css: input.css, assetIds: input.assetIds });
	} catch (cause) {
		if (cause instanceof ZoneThemeStylesheetRejected)
			throw new ZoneThemeStylesheetInvalid(
				cause.issues.map(({ code, column, line, message }) => ({
					code,
					...(column === undefined ? {} : { column }),
					...(line === undefined ? {} : { line }),
					message,
				})),
			);
		throw cause;
	}
	return database.transaction(async (tx) => {
		await ensureThemeExists(tx, input.themeUnitId);
		await ensureRevisionAssets(tx, input.profileId, input.assetIds);
		const [revision] = await tx
			.insert(zoneThemeRevision)
			.values({
				themeUnitId: input.themeUnitId,
				contractVersion: ZoneStylingContract.version,
				sourceCss: input.css,
				transformedCss: reviewed.transformedCss,
				sha256: reviewed.sha256,
				automatedReview: toStoredAutomatedReview(reviewed.automatedReview),
				submittedByProfileId: input.profileId,
			})
			.returning();
		if (!revision) throw new Error("Zone theme revision insertion returned no row");
		if (input.assetIds.length)
			await tx
				.insert(zoneThemeRevisionAsset)
				.values(input.assetIds.map((assetId) => ({ revisionId: revision.id, assetId })));
		return presentZoneThemeRevision(revision);
	});
}

export async function listZoneThemeRevisions(input: {
	readonly themeUnitId: string;
	readonly cursor?: string;
	readonly limit: number;
}) {
	await database.transaction((tx) => ensureThemeExists(tx, input.themeUnitId));
	const rows = await database
		.select()
		.from(zoneThemeRevision)
		.where(
			and(
				eq(zoneThemeRevision.themeUnitId, input.themeUnitId),
				...(input.cursor ? [gt(zoneThemeRevision.id, input.cursor)] : []),
			),
		)
		.orderBy(asc(zoneThemeRevision.id))
		.limit(input.limit + 1);
	const items = rows.slice(0, input.limit);
	return {
		items: items.map(presentZoneThemeRevision),
		nextCursor: rows.length > input.limit ? (items.at(-1)?.id ?? null) : null,
	};
}

export function validateZoneThemeRenderEvidence(review: StoredZoneThemeRenderReview): void {
	const expected = new Set(
		ZoneThemeReferenceBreakpoints.flatMap((breakpoint) =>
			ZoneThemeReferenceColorSchemes.map((colorScheme) => `${breakpoint}:${colorScheme}`),
		),
	);
	const actual = new Set(
		review.captures.map((capture) => `${capture.breakpoint}:${capture.colorScheme}`),
	);
	if (
		actual.size !== expected.size ||
		[...expected].some((key) => !actual.has(key)) ||
		new Set(review.captures.map(({ screenshotAssetId }) => screenshotAssetId)).size !==
			review.captures.length ||
		review.captures.some((capture) => capture.contrastViolations !== 0 || capture.layoutShift > 0.1)
	)
		throw new ZoneThemeAutomatedReviewInvalid();
}

export async function completeZoneThemeAutomatedReview(input: {
	readonly aiReview: StoredZoneThemeAiReview;
	readonly renderReview: StoredZoneThemeRenderReview;
	readonly revisionId: string;
	readonly themeUnitId: string;
}) {
	validateZoneThemeRenderEvidence(input.renderReview);
	if (!input.aiReview.passed) throw new ZoneThemeAutomatedReviewInvalid();
	return database.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(zoneThemeRevision)
			.where(
				and(
					eq(zoneThemeRevision.id, input.revisionId),
					eq(zoneThemeRevision.themeUnitId, input.themeUnitId),
				),
			)
			.limit(1)
			.for("update");
		if (!current) throw new ZoneThemeRevisionNotFound();
		if (current.state !== "pending_automated" && current.state !== "revalidation_required")
			throw new ZoneThemeRevisionStateConflict();
		await ensureRenderEvidenceAssetsReady(tx, input.renderReview);
		const [saved] = await tx
			.update(zoneThemeRevision)
			.set({
				state: "pending_human",
				renderReview: input.renderReview,
				aiReview: input.aiReview,
				decisionReason: null,
			})
			.where(eq(zoneThemeRevision.id, current.id))
			.returning();
		if (!saved) throw new Error("Zone theme automated review update returned no row");
		return presentZoneThemeRevision(saved);
	});
}

export async function decideZoneThemeRevision(input: {
	readonly decision: "approve" | "reject";
	readonly profileId: string;
	readonly reason?: string;
	readonly revisionId: string;
	readonly themeUnitId: string;
}) {
	return database.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(zoneThemeRevision)
			.where(
				and(
					eq(zoneThemeRevision.id, input.revisionId),
					eq(zoneThemeRevision.themeUnitId, input.themeUnitId),
				),
			)
			.limit(1)
			.for("update");
		if (!current) throw new ZoneThemeRevisionNotFound();
		if (current.state !== "pending_human") throw new ZoneThemeRevisionStateConflict();
		if (input.decision === "approve") await ensureBoundRevisionAssetsReadyAndPublic(tx, current.id);
		const [saved] = await tx
			.update(zoneThemeRevision)
			.set({
				state: input.decision === "approve" ? "approved" : "rejected",
				humanReviewedByProfileId: input.profileId,
				humanReviewedAt: new Date(),
				decisionReason: input.reason ?? null,
			})
			.where(eq(zoneThemeRevision.id, current.id))
			.returning();
		if (!saved) throw new Error("Zone theme decision update returned no row");
		return presentZoneThemeRevision(saved);
	});
}

export async function killZoneThemeRevision(input: {
	readonly profileId: string;
	readonly reason: string;
	readonly revisionId: string;
	readonly themeUnitId: string;
}) {
	return database.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(zoneThemeRevision)
			.where(
				and(
					eq(zoneThemeRevision.id, input.revisionId),
					eq(zoneThemeRevision.themeUnitId, input.themeUnitId),
				),
			)
			.limit(1)
			.for("update");
		if (!current) throw new ZoneThemeRevisionNotFound();
		if (current.state !== "approved") throw new ZoneThemeRevisionStateConflict();
		const [saved] = await tx
			.update(zoneThemeRevision)
			.set({
				state: "killed",
				killedByProfileId: input.profileId,
				killedAt: new Date(),
				decisionReason: input.reason,
			})
			.where(eq(zoneThemeRevision.id, current.id))
			.returning();
		if (!saved) throw new Error("Zone theme kill update returned no row");
		return presentZoneThemeRevision(saved);
	});
}

export async function listZoneThemeReviewQueue(input: {
	readonly cursor?: string;
	readonly limit: number;
}) {
	const rows = await database
		.select()
		.from(zoneThemeRevision)
		.where(
			and(
				inArray(zoneThemeRevision.state, [
					"pending_automated",
					"pending_human",
					"revalidation_required",
				]),
				...(input.cursor ? [gt(zoneThemeRevision.id, input.cursor)] : []),
			),
		)
		.orderBy(asc(zoneThemeRevision.id))
		.limit(input.limit + 1);
	const items = rows.slice(0, input.limit);
	const assetRows = items.length
		? await database
				.select({
					revisionId: zoneThemeRevisionAsset.revisionId,
					assetId: zoneThemeRevisionAsset.assetId,
				})
				.from(zoneThemeRevisionAsset)
				.where(
					inArray(
						zoneThemeRevisionAsset.revisionId,
						items.map(({ id }) => id),
					),
				)
		: [];
	const assetsByRevision = new Map<string, string[]>();
	for (const asset of assetRows) {
		const current = assetsByRevision.get(asset.revisionId) ?? [];
		current.push(asset.assetId);
		assetsByRevision.set(asset.revisionId, current);
	}
	return {
		items: items.map((row) => ({
			...presentZoneThemeRevision(row),
			sourceCss: row.sourceCss,
			transformedCss: row.transformedCss,
			assetIds: assetsByRevision.get(row.id) ?? [],
		})),
		nextCursor: rows.length > input.limit ? (items.at(-1)?.id ?? null) : null,
	};
}

/**
 * Re-runs static review for one exact prior contract version in a bounded
 * UUIDv7 keyset batch. Successful rows proceed through render and human review;
 * newly invalid rows fall back immediately and retain a concise rejection reason.
 */
export async function scheduleZoneThemeContractRevalidation(input: {
	readonly sourceContractVersion: string;
	readonly cursor?: string;
	readonly limit: number;
}) {
	if (input.sourceContractVersion === ZoneStylingContract.version)
		return {
			updated: 0,
			rejected: 0,
			contractVersion: ZoneStylingContract.version,
			nextCursor: null,
		};
	const candidates = await database
		.select({
			id: zoneThemeRevision.id,
			sourceCss: zoneThemeRevision.sourceCss,
		})
		.from(zoneThemeRevision)
		.where(
			and(
				eq(zoneThemeRevision.state, "approved"),
				eq(zoneThemeRevision.contractVersion, input.sourceContractVersion),
				...(input.cursor ? [gt(zoneThemeRevision.id, input.cursor)] : []),
			),
		)
		.orderBy(asc(zoneThemeRevision.id))
		.limit(input.limit);
	if (!candidates.length)
		return {
			updated: 0,
			rejected: 0,
			contractVersion: ZoneStylingContract.version,
			nextCursor: null,
		};
	const candidateIds = candidates.map(({ id }) => id);
	const assetRows = await database
		.select({
			revisionId: zoneThemeRevisionAsset.revisionId,
			assetId: zoneThemeRevisionAsset.assetId,
			access: imageAsset.access,
			status: imageAsset.status,
			deletedAt: imageAsset.deletedAt,
		})
		.from(zoneThemeRevisionAsset)
		.innerJoin(imageAsset, eq(imageAsset.id, zoneThemeRevisionAsset.assetId))
		.where(inArray(zoneThemeRevisionAsset.revisionId, candidateIds));
	const assetsByRevision = new Map<string, typeof assetRows>();
	for (const asset of assetRows) {
		const current = assetsByRevision.get(asset.revisionId) ?? [];
		current.push(asset);
		assetsByRevision.set(asset.revisionId, current);
	}
	let updated = 0;
	let rejected = 0;
	await database.transaction(async (tx) => {
		for (const candidate of candidates) {
			const assets = assetsByRevision.get(candidate.id) ?? [];
			const invalidAsset = assets.some(
				(asset) =>
					asset.access !== "public" || asset.status !== "ready" || asset.deletedAt !== null,
			);
			let reviewed: ReturnType<typeof reviewZoneThemeStylesheet> | undefined;
			let rejectionReason: string | undefined;
			if (invalidAsset) rejectionReason = "A revision asset is no longer ready and public";
			else {
				try {
					reviewed = reviewZoneThemeStylesheet({
						css: candidate.sourceCss,
						assetIds: assets.map(({ assetId }) => assetId),
					});
				} catch (cause) {
					if (!(cause instanceof ZoneThemeStylesheetRejected)) throw cause;
					rejectionReason = cause.issues
						.slice(0, 8)
						.map(({ code }) => code)
						.join(", ");
				}
			}
			const [saved] = reviewed
				? await tx
						.update(zoneThemeRevision)
						.set({
							contractVersion: ZoneStylingContract.version,
							transformedCss: reviewed.transformedCss,
							sha256: reviewed.sha256,
							automatedReview: toStoredAutomatedReview(reviewed.automatedReview),
							state: "revalidation_required",
							renderReview: null,
							aiReview: null,
							humanReviewedByProfileId: null,
							humanReviewedAt: null,
							decisionReason: null,
						})
						.where(
							and(
								eq(zoneThemeRevision.id, candidate.id),
								eq(zoneThemeRevision.state, "approved"),
								eq(zoneThemeRevision.contractVersion, input.sourceContractVersion),
							),
						)
						.returning({ id: zoneThemeRevision.id })
				: await tx
						.update(zoneThemeRevision)
						.set({
							state: "rejected",
							renderReview: null,
							aiReview: null,
							humanReviewedByProfileId: null,
							humanReviewedAt: null,
							decisionReason: `Contract ${ZoneStylingContract.version}: ${rejectionReason ?? "static review failed"}`,
						})
						.where(
							and(
								eq(zoneThemeRevision.id, candidate.id),
								eq(zoneThemeRevision.state, "approved"),
								eq(zoneThemeRevision.contractVersion, input.sourceContractVersion),
							),
						)
						.returning({ id: zoneThemeRevision.id });
			if (!saved) continue;
			updated += 1;
			if (!reviewed) rejected += 1;
		}
	});
	return {
		updated,
		rejected,
		contractVersion: ZoneStylingContract.version,
		nextCursor: candidates.length === input.limit ? (candidates.at(-1)?.id ?? null) : null,
	};
}

export async function ensureApprovedZoneThemeReference(
	tx: DatabaseTransaction,
	reference: ZoneCustomThemeReference | undefined,
): Promise<void> {
	if (!reference) return;
	const [revision] = await tx
		.select({ id: zoneThemeRevision.id })
		.from(zoneThemeRevision)
		.where(
			and(
				eq(zoneThemeRevision.id, reference.revisionId),
				eq(zoneThemeRevision.themeUnitId, reference.themeUnitId),
				eq(zoneThemeRevision.contractVersion, ZoneStylingContract.version),
				eq(zoneThemeRevision.state, "approved"),
				notExists(
					tx
						.select({ assetId: zoneThemeRevisionAsset.assetId })
						.from(zoneThemeRevisionAsset)
						.innerJoin(imageAsset, eq(imageAsset.id, zoneThemeRevisionAsset.assetId))
						.where(
							and(
								eq(zoneThemeRevisionAsset.revisionId, zoneThemeRevision.id),
								or(
									ne(imageAsset.status, "ready"),
									ne(imageAsset.access, "public"),
									isNotNull(imageAsset.deletedAt),
								),
							),
						),
				),
			),
		)
		.limit(1);
	if (!revision) throw new ZoneThemeReferenceInvalid();
}

/** Killed, rejected, stale-contract, invalid-asset, and pending revisions use token fallback. */
export async function resolveApprovedZoneThemeStylesheet(
	reference: ZoneCustomThemeReference | undefined,
): Promise<{ readonly revisionId: string; readonly sha256: string; readonly css: string } | null> {
	if (!reference) return null;
	const [revision] = await database
		.select({
			id: zoneThemeRevision.id,
			sha256: zoneThemeRevision.sha256,
			css: zoneThemeRevision.transformedCss,
		})
		.from(zoneThemeRevision)
		.where(
			and(
				eq(zoneThemeRevision.id, reference.revisionId),
				eq(zoneThemeRevision.themeUnitId, reference.themeUnitId),
				eq(zoneThemeRevision.contractVersion, ZoneStylingContract.version),
				eq(zoneThemeRevision.state, "approved"),
				notExists(
					database
						.select({ assetId: zoneThemeRevisionAsset.assetId })
						.from(zoneThemeRevisionAsset)
						.innerJoin(imageAsset, eq(imageAsset.id, zoneThemeRevisionAsset.assetId))
						.where(
							and(
								eq(zoneThemeRevisionAsset.revisionId, zoneThemeRevision.id),
								or(
									ne(imageAsset.status, "ready"),
									ne(imageAsset.access, "public"),
									isNotNull(imageAsset.deletedAt),
								),
							),
						),
				),
			),
		)
		.limit(1);
	return revision ? { revisionId: revision.id, sha256: revision.sha256, css: revision.css } : null;
}
