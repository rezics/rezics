import {
	assertBlockQueryBudget,
	assertUnitReferencedBlockDocument,
	createUnitPresentationDocumentV0,
	MaximumCustomThemeDiscoveredGraphNodes,
	parseDocument,
	UnitPresentationBlockHostPolicy,
	UnitPresentationDocumentV0,
	UnitPresentationTargetContractV0,
} from "@rezics/block";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import {
	CustomThemeInstallationInvalid,
	CustomThemeRevisionNotFound,
	UnitPresentationHostUnsupported,
	UnitPresentationRevisionConflict,
} from "../api/custom-themes/errors";
import { recordAuditEvent } from "../audit";
import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import {
	customThemeExecutionControl,
	customThemeRevision,
	customThemeRevisionExternalResource,
	customThemeRevisionFile,
	profilePreference,
	unit,
	unitCustomThemeInstallation,
	unitPresentationDocument,
	unitPresentationRevision,
	unitPresentationRevisionHead,
} from "../database/schema";
import { findOrCreateRevisionContent } from "../history/content";
import { storage } from "../storage";
import {
	customThemeExternalResourceBlocksExecution,
	ExecutableOrStyleExternalResourceRoles,
	parseStoredCustomThemeManifest,
	presentExternalResource,
} from "./service";

export const UnitPresentationContentModelV0 = "rezics.unit.presentation.v0" as const;
export const MaximumActiveUnpinnedCustomThemeGraphNodes = 1_000;
const CustomThemeInstallationAdmissionLockName = "custom-theme-installation-admission";

const EmptyUnitPresentationDocument = createUnitPresentationDocumentV0(
	{
		header: { _type: "block-document", _key: "000000000001", blocks: [] },
		footer: { _type: "block-document", _key: "000000000002", blocks: [] },
	},
	"000000000000",
);

function parsePresentationDocument(value: unknown) {
	const document = parseDocument(UnitPresentationDocumentV0, value);
	assertUnitReferencedBlockDocument(document.header, UnitPresentationBlockHostPolicy);
	assertUnitReferencedBlockDocument(document.footer, UnitPresentationBlockHostPolicy);
	assertBlockQueryBudget(
		{ blocks: [...document.header.blocks, ...document.footer.blocks] },
		UnitPresentationBlockHostPolicy,
	);
	return document;
}

async function ensureSupportedHost(executor: DatabaseExecutor, hostUnitId: string): Promise<void> {
	const [host] = await executor
		.select({ id: unit.id })
		.from(unit)
		.where(and(eq(unit.id, hostUnitId), eq(unit.kind, "zone"), isNull(unit.deletedAt)))
		.limit(1);
	if (!host) throw new UnitPresentationHostUnsupported();
}

export async function getUnitPresentation(executor: DatabaseExecutor, hostUnitId: string) {
	await ensureSupportedHost(executor, hostUnitId);
	const [row] = await executor
		.select({
			document: unitPresentationDocument.document,
			revisionId: unitPresentationRevisionHead.revisionId,
		})
		.from(unitPresentationDocument)
		.leftJoin(
			unitPresentationRevisionHead,
			and(
				eq(unitPresentationRevisionHead.hostUnitId, unitPresentationDocument.hostUnitId),
				eq(unitPresentationRevisionHead.targetContract, unitPresentationDocument.targetContract),
			),
		)
		.where(
			and(
				eq(unitPresentationDocument.hostUnitId, hostUnitId),
				eq(unitPresentationDocument.targetContract, UnitPresentationTargetContractV0),
			),
		)
		.limit(1);
	return {
		targetContract: UnitPresentationTargetContractV0,
		document: row ? parsePresentationDocument(row.document) : EmptyUnitPresentationDocument,
		revisionId: row?.revisionId ?? null,
	};
}

async function lockPresentation(tx: DatabaseTransaction, hostUnitId: string): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`unit-presentation:${hostUnitId}:${UnitPresentationTargetContractV0}`}::text, 0))`,
	);
}

async function lockCustomThemeInstallationAdmission(tx: DatabaseTransaction): Promise<void> {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${CustomThemeInstallationAdmissionLockName}::text, 0))`,
	);
}

export async function putUnitPresentation(
	tx: DatabaseTransaction,
	input: {
		readonly hostUnitId: string;
		readonly actorProfileId: string;
		readonly expectedRevisionId: string | null;
		readonly document: typeof UnitPresentationDocumentV0.static;
	},
) {
	await ensureSupportedHost(tx, input.hostUnitId);
	const document = parsePresentationDocument(input.document);
	await lockPresentation(tx, input.hostUnitId);
	const [head] = await tx
		.select({ revisionId: unitPresentationRevisionHead.revisionId })
		.from(unitPresentationRevisionHead)
		.where(
			and(
				eq(unitPresentationRevisionHead.hostUnitId, input.hostUnitId),
				eq(unitPresentationRevisionHead.targetContract, UnitPresentationTargetContractV0),
			),
		)
		.limit(1);
	if ((head?.revisionId ?? null) !== input.expectedRevisionId)
		throw new UnitPresentationRevisionConflict();
	await tx
		.insert(unitPresentationDocument)
		.values({
			hostUnitId: input.hostUnitId,
			targetContract: UnitPresentationTargetContractV0,
			document,
		})
		.onConflictDoUpdate({
			target: [unitPresentationDocument.hostUnitId, unitPresentationDocument.targetContract],
			set: { document },
		});
	const content = await findOrCreateRevisionContent(tx, {
		model: UnitPresentationContentModelV0,
		payload: document,
	});
	const [revision] = await tx
		.insert(unitPresentationRevision)
		.values({
			hostUnitId: input.hostUnitId,
			targetContract: UnitPresentationTargetContractV0,
			parentRevisionId: head?.revisionId ?? null,
			contentId: content.id,
			actorProfileId: input.actorProfileId,
			kind: head ? "update" : "create",
		})
		.returning({ id: unitPresentationRevision.id });
	if (!revision) throw new Error("Unit presentation revision insertion returned no row");
	await tx
		.insert(unitPresentationRevisionHead)
		.values({
			hostUnitId: input.hostUnitId,
			targetContract: UnitPresentationTargetContractV0,
			revisionId: revision.id,
		})
		.onConflictDoUpdate({
			target: [
				unitPresentationRevisionHead.hostUnitId,
				unitPresentationRevisionHead.targetContract,
			],
			set: { revisionId: revision.id },
		});
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "unit", id: input.hostUnitId },
		action: "unit.presentation.update",
		target: { kind: "unit", id: input.hostUnitId },
		details: { revisionId: revision.id, targetContract: UnitPresentationTargetContractV0 },
	});
	return { targetContract: UnitPresentationTargetContractV0, document, revisionId: revision.id };
}

async function ensureInstallationCandidate(
	tx: DatabaseTransaction,
	input: { readonly hostUnitId: string; readonly revisionId: string },
) {
	await ensureSupportedHost(tx, input.hostUnitId);
	const [revision] = await tx
		.select()
		.from(customThemeRevision)
		.where(
			and(
				eq(customThemeRevision.id, input.revisionId),
				eq(customThemeRevision.targetContract, UnitPresentationTargetContractV0),
			),
		)
		.limit(1)
		.for("share");
	if (!revision) throw new CustomThemeRevisionNotFound();
	if (
		revision.reviewState !== "approved" ||
		revision.approvedHostUnitId !== input.hostUnitId ||
		revision.resourceMode !== "external_live" ||
		revision.reviewEvidence?.automatedStatus !== "passed"
	)
		throw new CustomThemeInstallationInvalid();
	const resourceHealth = await tx
		.select({
			currentHealthState: customThemeRevisionExternalResource.currentHealthState,
			reviewEvidence: customThemeRevisionExternalResource.reviewEvidence,
		})
		.from(customThemeRevisionExternalResource)
		.where(eq(customThemeRevisionExternalResource.revisionId, revision.id))
		.limit(MaximumCustomThemeDiscoveredGraphNodes + 1);
	if (resourceHealth.some(customThemeExternalResourceBlocksExecution))
		throw new CustomThemeInstallationInvalid();
	const candidateUnpinned = await tx
		.select({ key: customThemeRevisionExternalResource.resourceKey })
		.from(customThemeRevisionExternalResource)
		.where(
			and(
				eq(customThemeRevisionExternalResource.revisionId, revision.id),
				isNull(customThemeRevisionExternalResource.integrityMetadata),
				inArray(customThemeRevisionExternalResource.role, ExecutableOrStyleExternalResourceRoles),
			),
		)
		.limit(MaximumActiveUnpinnedCustomThemeGraphNodes + 1);
	const activeUnpinned = await tx
		.selectDistinct({
			revisionId: customThemeRevisionExternalResource.revisionId,
			key: customThemeRevisionExternalResource.resourceKey,
		})
		.from(unitCustomThemeInstallation)
		.innerJoin(
			customThemeRevisionExternalResource,
			eq(customThemeRevisionExternalResource.revisionId, unitCustomThemeInstallation.revisionId),
		)
		.where(
			and(
				ne(unitCustomThemeInstallation.hostUnitId, input.hostUnitId),
				isNull(customThemeRevisionExternalResource.integrityMetadata),
				inArray(customThemeRevisionExternalResource.role, ExecutableOrStyleExternalResourceRoles),
			),
		)
		.limit(MaximumActiveUnpinnedCustomThemeGraphNodes + 1);
	const activeKeys = new Set(activeUnpinned.map(({ revisionId, key }) => `${revisionId}:${key}`));
	for (const { key } of candidateUnpinned) activeKeys.add(`${revision.id}:${key}`);
	if (activeKeys.size > MaximumActiveUnpinnedCustomThemeGraphNodes)
		throw new CustomThemeInstallationInvalid();
	return revision;
}

export async function putCustomThemeInstallation(
	tx: DatabaseTransaction,
	input: {
		readonly hostUnitId: string;
		readonly revisionId: string;
		readonly actorProfileId: string;
	},
) {
	await lockPresentation(tx, input.hostUnitId);
	await lockCustomThemeInstallationAdmission(tx);
	await ensureInstallationCandidate(tx, input);
	const [installation] = await tx
		.insert(unitCustomThemeInstallation)
		.values({
			hostUnitId: input.hostUnitId,
			targetContract: UnitPresentationTargetContractV0,
			revisionId: input.revisionId,
			installedByProfileId: input.actorProfileId,
		})
		.onConflictDoUpdate({
			target: [unitCustomThemeInstallation.hostUnitId, unitCustomThemeInstallation.targetContract],
			set: {
				revisionId: input.revisionId,
				installedByProfileId: input.actorProfileId,
			},
		})
		.returning();
	if (!installation) throw new Error("Custom Theme installation returned no row");
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "unit", id: input.hostUnitId },
		action: "custom_theme.installation.put",
		target: { kind: "unit", id: input.hostUnitId },
		details: { revisionId: input.revisionId, targetContract: UnitPresentationTargetContractV0 },
	});
	return installation;
}

export async function deleteCustomThemeInstallation(
	tx: DatabaseTransaction,
	input: { readonly hostUnitId: string; readonly actorProfileId: string },
): Promise<void> {
	await ensureSupportedHost(tx, input.hostUnitId);
	await lockPresentation(tx, input.hostUnitId);
	const removed = await tx
		.delete(unitCustomThemeInstallation)
		.where(
			and(
				eq(unitCustomThemeInstallation.hostUnitId, input.hostUnitId),
				eq(unitCustomThemeInstallation.targetContract, UnitPresentationTargetContractV0),
			),
		)
		.returning({ revisionId: unitCustomThemeInstallation.revisionId });
	if (!removed.length) return;
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "unit", id: input.hostUnitId },
		action: "custom_theme.installation.delete",
		target: { kind: "unit", id: input.hostUnitId },
		details: { revisionId: removed[0]?.revisionId ?? null },
	});
}

async function getExecutionEnabled(executor: DatabaseExecutor): Promise<boolean> {
	const [control] = await executor
		.select({ enabled: customThemeExecutionControl.enabled })
		.from(customThemeExecutionControl)
		.where(eq(customThemeExecutionControl.id, true))
		.limit(1);
	return control?.enabled ?? true;
}

export async function getCustomThemeExecutionControl(executor: DatabaseExecutor = database) {
	await executor
		.insert(customThemeExecutionControl)
		.values({ id: true, enabled: true })
		.onConflictDoNothing({ target: customThemeExecutionControl.id });
	const [control] = await executor
		.select()
		.from(customThemeExecutionControl)
		.where(eq(customThemeExecutionControl.id, true))
		.limit(1);
	if (!control) throw new Error("Custom Theme execution control is missing");
	return control;
}

export async function setCustomThemeExecutionControl(
	tx: DatabaseTransaction,
	input: { readonly enabled: boolean; readonly actorProfileId: string; readonly reason: string },
) {
	const [control] = await tx
		.insert(customThemeExecutionControl)
		.values({ id: true, enabled: input.enabled, updatedByProfileId: input.actorProfileId })
		.onConflictDoUpdate({
			target: customThemeExecutionControl.id,
			set: { enabled: input.enabled, updatedByProfileId: input.actorProfileId },
		})
		.returning();
	if (!control) throw new Error("Custom Theme execution control update returned no row");
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "platform" },
		action: input.enabled ? "custom_theme.execution.enable" : "custom_theme.execution.disable",
		target: { kind: "platform", id: "custom-theme-execution" },
		details: { reason: input.reason },
	});
	return control;
}

export type CustomThemeFallbackReason =
	| "none_installed"
	| "safe_mode"
	| "global_disabled"
	| "viewer_ineligible"
	| "viewer_opt_out"
	| "revision_unavailable";

export async function resolveUnitPresentation(input: {
	readonly hostUnitId: string;
	readonly viewerProfileId?: string;
	readonly viewerEligible: boolean;
	readonly safeMode: boolean;
}) {
	const presentation = await getUnitPresentation(database, input.hostUnitId);
	const fallback = (fallbackReason: CustomThemeFallbackReason) => ({
		targetContract: presentation.targetContract,
		document: presentation.document,
		documentRevisionId: presentation.revisionId,
		customTheme: null,
		fallbackReason,
	});
	if (input.safeMode) return fallback("safe_mode");
	if (!(await getExecutionEnabled(database))) return fallback("global_disabled");
	if (!input.viewerProfileId || !input.viewerEligible) return fallback("viewer_ineligible");
	const [preference] = await database
		.select({ enabled: profilePreference.customThemesEnabled })
		.from(profilePreference)
		.where(eq(profilePreference.profileId, input.viewerProfileId))
		.limit(1);
	if (preference && !preference.enabled) return fallback("viewer_opt_out");
	const [installation] = await database
		.select({ revisionId: unitCustomThemeInstallation.revisionId })
		.from(unitCustomThemeInstallation)
		.where(
			and(
				eq(unitCustomThemeInstallation.hostUnitId, input.hostUnitId),
				eq(unitCustomThemeInstallation.targetContract, UnitPresentationTargetContractV0),
			),
		)
		.limit(1);
	if (!installation) return fallback("none_installed");
	const [revision] = await database
		.select()
		.from(customThemeRevision)
		.where(
			and(
				eq(customThemeRevision.id, installation.revisionId),
				eq(customThemeRevision.reviewState, "approved"),
				eq(customThemeRevision.approvedHostUnitId, input.hostUnitId),
				eq(customThemeRevision.targetContract, UnitPresentationTargetContractV0),
			),
		)
		.limit(1);
	if (!revision || revision.reviewEvidence?.automatedStatus !== "passed")
		return fallback("revision_unavailable");
	const [resources, files] = await Promise.all([
		database
			.select()
			.from(customThemeRevisionExternalResource)
			.where(eq(customThemeRevisionExternalResource.revisionId, revision.id))
			.orderBy(asc(customThemeRevisionExternalResource.resourceKey)),
		database
			.select({
				path: customThemeRevisionFile.path,
				role: customThemeRevisionFile.role,
				contentType: customThemeRevisionFile.contentType,
				sha256: customThemeRevisionFile.sha256,
			})
			.from(customThemeRevisionFile)
			.where(
				and(
					eq(customThemeRevisionFile.revisionId, revision.id),
					inArray(customThemeRevisionFile.role, [
						"html",
						"css",
						"js",
						"worker",
						"wasm",
						"font",
						"svg",
						"asset",
					]),
				),
			)
			.orderBy(asc(customThemeRevisionFile.path)),
	]);
	if (resources.some(customThemeExternalResourceBlocksExecution))
		return fallback("revision_unavailable");
	const packagedFiles = files.map((file) => {
		const query = new URLSearchParams({ path: file.path, hostUnitId: input.hostUnitId });
		return {
			...file,
			contentUrl: `/api/v1/custom-themes/${revision.customThemeUnitId}/revisions/${revision.id}/file?${query}`,
		};
	});
	return {
		targetContract: presentation.targetContract,
		document: presentation.document,
		documentRevisionId: presentation.revisionId,
		customTheme: {
			revisionId: revision.id,
			customThemeUnitId: revision.customThemeUnitId,
			executionMode: revision.executionMode,
			resourceMode: revision.resourceMode,
			executionAudience: "capability_gated_preview" as const,
			approvalScope: { kind: "host_unit" as const, hostUnitId: input.hostUnitId },
			manifest: parseStoredCustomThemeManifest(revision.manifestDocument),
			externalResources: resources.map(presentExternalResource),
			packagedFiles,
		},
		fallbackReason: null,
	};
}

export async function getExecutableCustomThemeFile(input: {
	readonly themeUnitId: string;
	readonly revisionId: string;
	readonly hostUnitId: string;
	readonly viewerProfileId: string;
	readonly path: string;
}) {
	if (!(await getExecutionEnabled(database))) throw new CustomThemeInstallationInvalid();
	const [preference] = await database
		.select({ enabled: profilePreference.customThemesEnabled })
		.from(profilePreference)
		.where(eq(profilePreference.profileId, input.viewerProfileId))
		.limit(1);
	if (preference && !preference.enabled) throw new CustomThemeInstallationInvalid();
	const [file] = await database
		.select({
			storageKey: customThemeRevisionFile.storageKey,
			contentType: customThemeRevisionFile.contentType,
			sha256: customThemeRevisionFile.sha256,
			reviewEvidence: customThemeRevision.reviewEvidence,
		})
		.from(unitCustomThemeInstallation)
		.innerJoin(
			customThemeRevision,
			and(
				eq(customThemeRevision.id, unitCustomThemeInstallation.revisionId),
				eq(customThemeRevision.reviewState, "approved"),
				eq(customThemeRevision.approvedHostUnitId, unitCustomThemeInstallation.hostUnitId),
			),
		)
		.innerJoin(
			customThemeRevisionFile,
			eq(customThemeRevisionFile.revisionId, customThemeRevision.id),
		)
		.where(
			and(
				eq(unitCustomThemeInstallation.hostUnitId, input.hostUnitId),
				eq(unitCustomThemeInstallation.targetContract, UnitPresentationTargetContractV0),
				eq(customThemeRevision.id, input.revisionId),
				eq(customThemeRevision.customThemeUnitId, input.themeUnitId),
				eq(customThemeRevisionFile.path, input.path),
				inArray(customThemeRevisionFile.role, [
					"html",
					"css",
					"js",
					"worker",
					"wasm",
					"font",
					"svg",
					"asset",
				]),
			),
		)
		.limit(1);
	if (!file || file.reviewEvidence?.automatedStatus !== "passed")
		throw new CustomThemeInstallationInvalid();
	const resourceHealth = await database
		.select({
			currentHealthState: customThemeRevisionExternalResource.currentHealthState,
			reviewEvidence: customThemeRevisionExternalResource.reviewEvidence,
		})
		.from(customThemeRevisionExternalResource)
		.where(eq(customThemeRevisionExternalResource.revisionId, input.revisionId))
		.limit(MaximumCustomThemeDiscoveredGraphNodes + 1);
	if (resourceHealth.some(customThemeExternalResourceBlocksExecution))
		throw new CustomThemeInstallationInvalid();
	const object = await storage.get({ Key: file.storageKey });
	const bytes = await object.Body?.transformToByteArray();
	if (!bytes) throw new CustomThemeInstallationInvalid();
	return { bytes, contentType: file.contentType, sha256: file.sha256 };
}

export function presentationPolicyFromResolved(
	resolved: Awaited<ReturnType<typeof resolveUnitPresentation>>,
) {
	if (!resolved.customTheme)
		return {
			revisionId: null,
			scriptOrigins: [],
			styleOrigins: [],
			connectOrigins: [],
			imageOrigins: [],
			fontOrigins: [],
			frameOrigins: [],
			mediaOrigins: [],
		};
	const scriptOrigins = new Set<string>();
	const styleOrigins = new Set<string>();
	const styleResourceRoles = new Set(["style_direct", "css_import", "runtime_style"]);
	const scriptResourceRoles = new Set([
		"classic_script_direct",
		"module_entry_direct",
		"module_dependency",
		"worker_dependency",
		"service_worker_attempt",
		"runtime_script",
	]);
	for (const resource of resolved.customTheme.externalResources) {
		const resourceOrigins = new Set(
			[resource.requestedUrl, ...resource.redirectChain, resource.finalUrl].map(
				(url) => new URL(url).origin,
			),
		);
		if (styleResourceRoles.has(resource.role))
			for (const origin of resourceOrigins) styleOrigins.add(origin);
		if (scriptResourceRoles.has(resource.role))
			for (const origin of resourceOrigins) scriptOrigins.add(origin);
	}
	if (resolved.customTheme.packagedFiles.some(({ role }) => role === "js"))
		scriptOrigins.add("blob:");
	if (resolved.customTheme.packagedFiles.some(({ role }) => role === "css"))
		styleOrigins.add("blob:");
	const origins = resolved.customTheme.manifest.declaredRuntimeOrigins;
	return {
		revisionId: resolved.customTheme.revisionId,
		scriptOrigins: [...scriptOrigins],
		styleOrigins: [...styleOrigins],
		connectOrigins: [...origins.connect],
		imageOrigins: [...origins.image],
		fontOrigins: [...origins.font],
		frameOrigins: [...origins.frame],
		mediaOrigins: [...origins.media],
	};
}
