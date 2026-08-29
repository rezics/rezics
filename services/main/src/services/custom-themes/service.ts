import { createHash } from "node:crypto";

import type { AvatarReference } from "@rezics/avatar";
import {
	CustomThemeHumanReviewEvidenceV0,
	CustomThemeReferenceRenderEvidenceV0,
	MaximumCustomThemeDiscoveredGraphNodes,
	parseDocument,
	SubmittedCustomThemeManifestV0,
	type CustomThemeHumanReviewEvidenceV0 as CustomThemeHumanReviewEvidence,
	type CustomThemeReferenceRenderEvidenceV0 as CustomThemeReferenceRenderEvidence,
	type SubmittedCustomThemeManifestV0 as SubmittedCustomThemeManifest,
	type PortableTextDocument,
} from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";

import {
	CustomThemeInstallationInvalid,
	CustomThemeNotFound,
	CustomThemeReviewerSeparationRequired,
	CustomThemeReviewEvidenceInvalid,
	CustomThemeRevisionNotFound,
	CustomThemeRevisionStateConflict,
	CustomThemeSubmissionBackpressure,
} from "../api/custom-themes/errors";
import { ensureImageAssetsAttachable } from "../api/image-assets/service";
import { recordAuditEvent } from "../audit";
import { createProfileOwnedUnitAccess } from "../authorization/unit/ownership";
import {
	database,
	databasePoolWaitP95Milliseconds,
	type DatabaseExecutor,
	type DatabaseTransaction,
} from "../database";
import {
	customTheme,
	customThemeRevision,
	customThemeRevisionExternalResource,
	customThemeRevisionFile,
	customThemeRevisionReviewEvent,
	unit,
	unitLocalization,
	unitCustomThemeInstallation,
} from "../database/schema";
import { canonicalRevisionJson } from "../history/content";
import { storage } from "../storage";
import { insertUnit } from "../units/create";
import { toUnitLocalizationStorage } from "../units/localization";
import { validateSubmittedCustomThemePackage, type SubmittedCustomThemeFileInput } from "./package";

export const MaximumCustomThemeReviewQueueDepth = 10_000;
export const MaximumActiveCustomThemeRevisions = 100_000;
export const MaximumCustomThemeReviewQueueAgeMilliseconds = 15 * 60_000;
export const MaximumUnpinnedMonitorQueueAgeMilliseconds = 5 * 60_000;
export const MaximumDatabasePoolWaitP95Milliseconds = 50;

const CustomThemeSubmissionAdmissionLockName = "custom-theme-submission-admission";

export const ExecutableOrStyleExternalResourceRoles = [
	"style_direct",
	"classic_script_direct",
	"module_entry_direct",
	"css_import",
	"module_dependency",
	"worker_dependency",
	"service_worker_attempt",
	"wasm_dependency",
	"runtime_script",
	"runtime_style",
] as const;

export type CustomThemeSubmissionBackpressureReason =
	| "active_revision_bound"
	| "database_pool_wait"
	| "review_queue_depth"
	| "review_queue_age"
	| "monitor_queue_age";

export function customThemeSubmissionBackpressureReason(input: {
	readonly activeRevisionCount: number;
	readonly databasePoolWaitP95Milliseconds: number;
	readonly reviewQueueDepth: number;
	readonly hasStaleReview: boolean;
	readonly hasStaleUnpinnedMonitor: boolean;
}): CustomThemeSubmissionBackpressureReason | null {
	if (input.databasePoolWaitP95Milliseconds > MaximumDatabasePoolWaitP95Milliseconds)
		return "database_pool_wait";
	if (input.activeRevisionCount >= MaximumActiveCustomThemeRevisions)
		return "active_revision_bound";
	if (input.reviewQueueDepth > MaximumCustomThemeReviewQueueDepth) return "review_queue_depth";
	if (input.hasStaleReview) return "review_queue_age";
	if (input.hasStaleUnpinnedMonitor) return "monitor_queue_age";
	return null;
}

export interface CustomThemeLocalizationInput {
	readonly language: ContentLanguage;
	readonly title: string;
	readonly summary?: string;
	readonly description?: PortableTextDocument;
	readonly avatar?: AvatarReference | null;
	readonly bannerAssetId?: string | null;
	readonly coverAssetId?: string | null;
}

export function parseStoredCustomThemeManifest(value: unknown) {
	return parseDocument(SubmittedCustomThemeManifestV0, value);
}

function isExactHttpsOrigin(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && value === url.origin;
	} catch {
		return false;
	}
}

export function customThemeObservedRuntimeOriginsAreCovered(
	manifest: SubmittedCustomThemeManifest,
	evidence: CustomThemeReferenceRenderEvidence,
): boolean {
	const kinds = ["connect", "image", "font", "frame", "media"] as const;
	return kinds.every((kind) => {
		const declared = new Set(manifest.declaredRuntimeOrigins[kind]);
		return evidence.observedRuntimeOrigins[kind].every(
			(origin) => isExactHttpsOrigin(origin) && declared.has(origin),
		);
	});
}

export function customThemeReferenceRenderEvidenceIsComplete(
	evidence: CustomThemeReferenceRenderEvidence,
): boolean {
	const meaningful = (value: string) => value.trim().length > 0;
	const colorSchemes = new Set(evidence.fixtures.map(({ colorScheme }) => colorScheme));
	return Boolean(
		meaningful(evidence.rendererVersion) &&
			evidence.fixtures.every(
				({ viewport, loadFailureCount }) => meaningful(viewport) && loadFailureCount === 0,
			) &&
			evidence.accessibilityFindings.every(meaningful) &&
			evidence.cleanupPassed &&
			colorSchemes.has("light") &&
			colorSchemes.has("dark"),
	);
}

export function customThemeHumanReviewEvidenceIsComplete(
	evidence: CustomThemeHumanReviewEvidence,
): boolean {
	const meaningful = (value: string) => value.trim().length > 0;
	return Boolean(
		meaningful(evidence.owner) &&
			meaningful(evidence.incidentContact) &&
			evidence.acknowledgedRisks.every(meaningful) &&
			evidence.licenseFindings.every(meaningful),
	);
}

export function presentCustomThemeRevision(row: typeof customThemeRevision.$inferSelect) {
	return {
		id: row.id,
		customThemeUnitId: row.customThemeUnitId,
		targetContract: row.targetContract,
		executionMode: row.executionMode,
		resourceMode: row.resourceMode,
		manifest: parseStoredCustomThemeManifest(row.manifestDocument),
		manifestSha256: row.manifestSha256,
		sourceArchiveSha256: row.sourceArchiveSha256,
		reviewState: row.reviewState,
		approvalScope: row.approvalScope,
		approvedHostUnitId: row.approvedHostUnitId,
		submittedByProfileId: row.submittedByProfileId,
		reviewedByProfileId: row.reviewedByProfileId,
		reviewedAt: row.reviewedAt,
		decisionReason: row.decisionReason,
		killedAt: row.killedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

async function ensureThemeExists(executor: DatabaseExecutor, themeUnitId: string): Promise<void> {
	const [theme] = await executor
		.select({ id: customTheme.id })
		.from(customTheme)
		.innerJoin(unit, and(eq(unit.id, customTheme.id), eq(unit.kind, "custom_theme")))
		.where(and(eq(customTheme.id, themeUnitId), isNull(unit.deletedAt)))
		.limit(1);
	if (!theme) throw new CustomThemeNotFound();
}

export async function ensureCustomThemeExists(themeUnitId: string): Promise<void> {
	await ensureThemeExists(database, themeUnitId);
}

export async function createCustomTheme(input: {
	readonly ownerProfileId: string;
	readonly localization: CustomThemeLocalizationInput;
}) {
	return database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(tx, input.ownerProfileId, [
			{ assetId: input.localization.bannerAssetId, role: "banner" },
			{ assetId: input.localization.coverAssetId, role: "cover" },
		]);
		const created = await insertUnit(tx, {
			kind: "custom_theme",
			status: "published",
			visibility: "public",
			publishedAt: new Date(),
			statusActor: { kind: "profile", profileId: input.ownerProfileId },
		});
		await tx.insert(customTheme).values({ id: created.id });
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

async function generateRevisionId(): Promise<string> {
	type GeneratedUuidRow = { readonly id: string };
	const generated = await database.execute<GeneratedUuidRow>(sql`select uuidv7() as id`);
	const id = generated.rows[0]?.id;
	if (!id) throw new Error("Custom Theme revision UUIDv7 generation returned no id");
	return id;
}

function storageKeyForFile(
	themeUnitId: string,
	revisionId: string,
	path: string,
	sha256: string,
): string {
	const pathHash = createHash("sha256").update(path).digest("hex").slice(0, 24);
	return `custom-themes/${themeUnitId}/${revisionId}/${pathHash}-${sha256}`;
}

export async function ensureCustomThemeSubmissionAdmission(
	executor: DatabaseExecutor,
	now = new Date(),
): Promise<void> {
	const reviewStates = ["pending_automated", "pending_human", "revalidation_required"] as const;
	const activeStates = [...reviewStates, "approved"] as const;
	const reviewAgeCutoff = new Date(now.getTime() - MaximumCustomThemeReviewQueueAgeMilliseconds);
	const monitorAgeCutoff = new Date(now.getTime() - MaximumUnpinnedMonitorQueueAgeMilliseconds);
	const poolWait = databasePoolWaitP95Milliseconds();
	if (poolWait > MaximumDatabasePoolWaitP95Milliseconds)
		throw new CustomThemeSubmissionBackpressure({ reason: "database_pool_wait" });
	const activeBoundRows = await executor
		.select({ id: customThemeRevision.id })
		.from(customThemeRevision)
		.where(inArray(customThemeRevision.reviewState, activeStates))
		.orderBy(customThemeRevision.id)
		.limit(1)
		.offset(MaximumActiveCustomThemeRevisions - 1);
	const queueOverflowRows = await executor
		.select({ id: customThemeRevision.id })
		.from(customThemeRevision)
		.where(inArray(customThemeRevision.reviewState, reviewStates))
		.orderBy(customThemeRevision.id)
		.limit(1)
		.offset(MaximumCustomThemeReviewQueueDepth);
	const staleReview = await executor
		.select({ id: customThemeRevision.id })
		.from(customThemeRevision)
		.where(
			and(
				inArray(customThemeRevision.reviewState, reviewStates),
				lte(customThemeRevision.nextAutomatedReviewAt, reviewAgeCutoff),
			),
		)
		.limit(1);
	const staleUnpinnedMonitor = await executor
		.select({ key: customThemeRevisionExternalResource.resourceKey })
		.from(unitCustomThemeInstallation)
		.innerJoin(
			customThemeRevisionExternalResource,
			eq(customThemeRevisionExternalResource.revisionId, unitCustomThemeInstallation.revisionId),
		)
		.where(
			and(
				isNull(customThemeRevisionExternalResource.integrityMetadata),
				inArray(customThemeRevisionExternalResource.role, ExecutableOrStyleExternalResourceRoles),
				lte(customThemeRevisionExternalResource.nextCheckAt, monitorAgeCutoff),
			),
		)
		.limit(1);
	const reason = customThemeSubmissionBackpressureReason({
		activeRevisionCount: activeBoundRows.length ? MaximumActiveCustomThemeRevisions : 0,
		databasePoolWaitP95Milliseconds: poolWait,
		reviewQueueDepth: queueOverflowRows.length ? MaximumCustomThemeReviewQueueDepth + 1 : 0,
		hasStaleReview: staleReview.length > 0,
		hasStaleUnpinnedMonitor: staleUnpinnedMonitor.length > 0,
	});
	if (reason) throw new CustomThemeSubmissionBackpressure({ reason });
}

async function lockCustomThemeSubmissionAdmission(tx: DatabaseTransaction): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${CustomThemeSubmissionAdmissionLockName}::text, 0))`,
	);
}

export async function submitCustomThemeRevision(input: {
	readonly themeUnitId: string;
	readonly profileId: string;
	readonly manifest: typeof SubmittedCustomThemeManifestV0.static;
	readonly sourceArchive: { readonly contentType: string; readonly contentBase64: string };
	readonly files: readonly SubmittedCustomThemeFileInput[];
}) {
	await ensureThemeExists(database, input.themeUnitId);
	await ensureCustomThemeSubmissionAdmission(database);
	const revisionId = await generateRevisionId();
	const validated = validateSubmittedCustomThemePackage(input);
	const storedFiles = validated.files.map((file) => ({
		...file,
		storageKey: storageKeyForFile(input.themeUnitId, revisionId, file.path, file.sha256),
	}));
	const uploadedKeys: string[] = [];
	try {
		for (const file of storedFiles) {
			await storage.put({
				Key: file.storageKey,
				Body: file.bytes,
				ContentLength: file.bytes.byteLength,
				ContentType: file.contentType,
				CacheControl: "private, no-store",
				Metadata: {
					custom_theme_revision_id: revisionId,
					sha256: file.sha256,
				},
			});
			uploadedKeys.push(file.storageKey);
		}
		return await database.transaction(async (tx) => {
			await ensureThemeExists(tx, input.themeUnitId);
			await lockCustomThemeSubmissionAdmission(tx);
			await ensureCustomThemeSubmissionAdmission(tx);
			const [revision] = await tx
				.insert(customThemeRevision)
				.values({
					id: revisionId,
					customThemeUnitId: input.themeUnitId,
					targetContract: "rezics.unit.presentation@0",
					executionMode: "host_full_trust",
					resourceMode: "external_live",
					manifestDocument: validated.manifest,
					manifestSha256: validated.manifestSha256,
					sourceArchiveSha256: validated.sourceArchiveSha256,
					submittedByProfileId: input.profileId,
				})
				.returning();
			if (!revision) throw new Error("Custom Theme revision insertion returned no row");
			await tx.insert(customThemeRevisionFile).values(
				storedFiles.map((file) => ({
					revisionId,
					path: file.path,
					role: file.role,
					contentType: file.contentType,
					sha256: file.sha256,
					byteLength: file.bytes.byteLength,
					storageKey: file.storageKey,
				})),
			);
			await recordAuditEvent(tx, {
				category: "admin_activity",
				outcome: "succeeded",
				actor: { kind: "profile", profileId: input.profileId },
				authority: { kind: "unit", id: input.themeUnitId },
				action: "custom_theme.revision.submit",
				target: { kind: "unit", id: input.themeUnitId },
				details: {
					revisionId,
					manifestSha256: validated.manifestSha256,
					sourceArchiveSha256: validated.sourceArchiveSha256,
					fileCount: storedFiles.length,
					resourceMode: "external_live",
				},
			});
			return presentCustomThemeRevision(revision);
		});
	} catch (error) {
		await Promise.all(uploadedKeys.map((Key) => storage.delete({ Key }).catch(() => undefined)));
		throw error;
	}
}

export async function listCustomThemeRevisions(input: {
	readonly themeUnitId: string;
	readonly cursor?: string;
	readonly limit: number;
}) {
	await ensureThemeExists(database, input.themeUnitId);
	const rows = await database
		.select()
		.from(customThemeRevision)
		.where(
			and(
				eq(customThemeRevision.customThemeUnitId, input.themeUnitId),
				...(input.cursor ? [gt(customThemeRevision.id, input.cursor)] : []),
			),
		)
		.orderBy(asc(customThemeRevision.id))
		.limit(input.limit + 1);
	const items = rows.slice(0, input.limit);
	return {
		items: items.map(presentCustomThemeRevision),
		nextCursor: rows.length > input.limit ? (items.at(-1)?.id ?? null) : null,
	};
}

async function loadReviewMaterial(revisionIds: readonly string[]) {
	if (!revisionIds.length) return new Map<string, { files: never[]; externalResources: never[] }>();
	const [files, resources] = await Promise.all([
		database
			.select({
				revisionId: customThemeRevisionFile.revisionId,
				path: customThemeRevisionFile.path,
				role: customThemeRevisionFile.role,
				contentType: customThemeRevisionFile.contentType,
				sha256: customThemeRevisionFile.sha256,
				byteLength: customThemeRevisionFile.byteLength,
			})
			.from(customThemeRevisionFile)
			.where(inArray(customThemeRevisionFile.revisionId, [...revisionIds])),
		database
			.select()
			.from(customThemeRevisionExternalResource)
			.where(inArray(customThemeRevisionExternalResource.revisionId, [...revisionIds])),
	]);
	const result = new Map<
		string,
		{
			files: Omit<(typeof files)[number], "revisionId">[];
			externalResources: ReturnType<typeof presentExternalResource>[];
		}
	>();
	for (const revisionId of revisionIds)
		result.set(revisionId, { files: [], externalResources: [] });
	for (const { revisionId, ...file } of files) result.get(revisionId)?.files.push(file);
	for (const resource of resources)
		result.get(resource.revisionId)?.externalResources.push(presentExternalResource(resource));
	return result;
}

export function presentExternalResource(
	row: typeof customThemeRevisionExternalResource.$inferSelect,
) {
	const evidence = row.reviewEvidence;
	const redirectChain = Array.isArray(evidence.redirectChain)
		? evidence.redirectChain.filter((value): value is string => typeof value === "string")
		: [];
	return {
		resourceKey: row.resourceKey,
		role: row.role,
		requestedUrl: row.requestedUrl,
		finalUrl: row.finalUrl,
		redirectChain,
		observedSha256: row.observedSha256,
		observedByteLength: row.observedByteLength,
		observedContentType: row.observedContentType,
		observedAt: row.observedAt.toISOString(),
		corsAllowsAnonymous: row.corsAllowsAnonymous,
		required: evidence.required !== false,
		effectiveIntegrity: row.integrityMetadata,
		integrityWaiverReason: row.integrityWaiverReason,
	};
}

export function customThemeExternalResourceBlocksExecution(
	resource: Pick<
		typeof customThemeRevisionExternalResource.$inferSelect,
		"currentHealthState" | "reviewEvidence"
	>,
): boolean {
	return (
		resource.currentHealthState === "drifted" ||
		resource.currentHealthState === "unchecked" ||
		(resource.currentHealthState === "unavailable" && resource.reviewEvidence.required !== false)
	);
}

export async function listCustomThemeReviewQueue(input: {
	readonly cursor?: string;
	readonly limit: number;
}) {
	const rows = await database
		.select()
		.from(customThemeRevision)
		.where(
			and(
				inArray(customThemeRevision.reviewState, [
					"pending_automated",
					"pending_human",
					"revalidation_required",
				]),
				...(input.cursor ? [gt(customThemeRevision.id, input.cursor)] : []),
			),
		)
		.orderBy(asc(customThemeRevision.id))
		.limit(input.limit + 1);
	const items = rows.slice(0, input.limit);
	const material = await loadReviewMaterial(items.map(({ id }) => id));
	return {
		items: items.map((row) => ({
			...presentCustomThemeRevision(row),
			files: material.get(row.id)?.files ?? [],
			externalResources: material.get(row.id)?.externalResources ?? [],
			reviewEvidence: row.reviewEvidence,
		})),
		nextCursor: rows.length > input.limit ? (items.at(-1)?.id ?? null) : null,
	};
}

async function loadRevisionForUpdate(
	tx: DatabaseTransaction,
	input: { readonly themeUnitId: string; readonly revisionId: string },
) {
	const [revision] = await tx
		.select()
		.from(customThemeRevision)
		.where(
			and(
				eq(customThemeRevision.id, input.revisionId),
				eq(customThemeRevision.customThemeUnitId, input.themeUnitId),
			),
		)
		.limit(1)
		.for("update");
	if (!revision) throw new CustomThemeRevisionNotFound();
	return revision;
}

export async function decideCustomThemeRevision(input: {
	readonly decision: "approve" | "reject";
	readonly profileId: string;
	readonly reason?: string;
	readonly revisionId: string;
	readonly themeUnitId: string;
	readonly hostUnitId?: string;
	readonly reviewEvidence?: unknown;
}) {
	return database.transaction(async (tx) => {
		const current = await loadRevisionForUpdate(tx, input);
		let humanReviewEvidence: CustomThemeHumanReviewEvidence | undefined;
		if (current.reviewState !== "pending_human" && current.reviewState !== "revalidation_required")
			throw new CustomThemeRevisionStateConflict();
		if (current.submittedByProfileId === input.profileId)
			throw new CustomThemeReviewerSeparationRequired();
		if (input.decision === "approve") {
			if (!input.hostUnitId || !input.reviewEvidence) throw new CustomThemeReviewEvidenceInvalid();
			let referenceRenderEvidence: CustomThemeReferenceRenderEvidence;
			try {
				humanReviewEvidence = parseDocument(CustomThemeHumanReviewEvidenceV0, input.reviewEvidence);
				referenceRenderEvidence = parseDocument(
					CustomThemeReferenceRenderEvidenceV0,
					current.reviewEvidence?.referenceRender,
				);
			} catch {
				throw new CustomThemeReviewEvidenceInvalid();
			}
			if (
				!customThemeHumanReviewEvidenceIsComplete(humanReviewEvidence) ||
				!customThemeReferenceRenderEvidenceIsComplete(referenceRenderEvidence) ||
				!customThemeObservedRuntimeOriginsAreCovered(
					parseStoredCustomThemeManifest(current.manifestDocument),
					referenceRenderEvidence,
				)
			)
				throw new CustomThemeReviewEvidenceInvalid();
			if (
				current.reviewState === "revalidation_required" &&
				current.approvedHostUnitId !== input.hostUnitId
			)
				throw new CustomThemeReviewEvidenceInvalid();
			const [host] = await tx
				.select({ id: unit.id })
				.from(unit)
				.where(and(eq(unit.id, input.hostUnitId), eq(unit.kind, "zone"), isNull(unit.deletedAt)))
				.limit(1);
			if (!host) throw new CustomThemeInstallationInvalid();
			const resourceHealth = await tx
				.select({
					currentHealthState: customThemeRevisionExternalResource.currentHealthState,
					reviewEvidence: customThemeRevisionExternalResource.reviewEvidence,
				})
				.from(customThemeRevisionExternalResource)
				.where(eq(customThemeRevisionExternalResource.revisionId, current.id))
				.limit(MaximumCustomThemeDiscoveredGraphNodes + 1);
			if (resourceHealth.some(customThemeExternalResourceBlocksExecution))
				throw new CustomThemeReviewEvidenceInvalid();
			if (!current.reviewEvidence || current.reviewEvidence.automatedStatus !== "passed")
				throw new CustomThemeReviewEvidenceInvalid();
		}
		if (input.decision === "reject" && !input.reason) throw new CustomThemeReviewEvidenceInvalid();
		const now = new Date();
		const evidence =
			input.decision === "approve"
				? {
						...(current.reviewEvidence ?? {}),
						humanReview: humanReviewEvidence,
					}
				: current.reviewEvidence;
		const evidenceSha256 = evidence
			? createHash("sha256").update(canonicalRevisionJson(evidence)).digest("hex")
			: null;
		const [saved] = await tx
			.update(customThemeRevision)
			.set({
				reviewState: input.decision === "approve" ? "approved" : "rejected",
				approvedHostUnitId: input.decision === "approve" ? input.hostUnitId : null,
				reviewEvidence: evidence,
				reviewEvidenceSha256: evidenceSha256,
				reviewedByProfileId: input.profileId,
				reviewedAt: now,
				decisionReason: input.reason ?? null,
			})
			.where(eq(customThemeRevision.id, current.id))
			.returning();
		if (!saved) throw new Error("Custom Theme review decision returned no row");
		const eventEvidence = {
			...((evidence ?? {}) as Record<string, unknown>),
			decision: input.decision,
			reason: input.reason ?? null,
			approvedHostUnitId: input.decision === "approve" ? input.hostUnitId : null,
		};
		await tx.insert(customThemeRevisionReviewEvent).values({
			revisionId: current.id,
			kind: input.decision,
			actorProfileId: input.profileId,
			evidence: eventEvidence,
			evidenceSha256: createHash("sha256")
				.update(canonicalRevisionJson(eventEvidence))
				.digest("hex"),
		});
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.profileId },
			authority: { kind: "platform" },
			action: `custom_theme.revision.${input.decision}`,
			target: { kind: "unit", id: input.themeUnitId },
			details: {
				revisionId: current.id,
				approvedHostUnitId: input.decision === "approve" ? input.hostUnitId : null,
				reviewEvidenceSha256: evidenceSha256,
			},
		});
		return presentCustomThemeRevision(saved);
	});
}

export async function killCustomThemeRevision(input: {
	readonly profileId: string;
	readonly reason: string;
	readonly revisionId: string;
	readonly themeUnitId: string;
}) {
	return database.transaction(async (tx) => {
		const current = await loadRevisionForUpdate(tx, input);
		if (current.reviewState !== "approved" && current.reviewState !== "revalidation_required")
			throw new CustomThemeRevisionStateConflict();
		const now = new Date();
		const [saved] = await tx
			.update(customThemeRevision)
			.set({
				reviewState: "killed",
				killedByProfileId: input.profileId,
				killedAt: now,
				decisionReason: input.reason,
			})
			.where(eq(customThemeRevision.id, current.id))
			.returning();
		if (!saved) throw new Error("Custom Theme kill returned no row");
		const killEvidence = {
			reason: input.reason,
			previousReviewEvidenceSha256: current.reviewEvidenceSha256,
		};
		await tx.insert(customThemeRevisionReviewEvent).values({
			revisionId: current.id,
			kind: "kill",
			actorProfileId: input.profileId,
			evidence: killEvidence,
			evidenceSha256: createHash("sha256")
				.update(canonicalRevisionJson(killEvidence))
				.digest("hex"),
		});
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.profileId },
			authority: { kind: "platform" },
			action: "custom_theme.revision.kill",
			target: { kind: "unit", id: input.themeUnitId },
			details: { revisionId: current.id, reason: input.reason },
		});
		return presentCustomThemeRevision(saved);
	});
}
