import { createHash } from "node:crypto";

import {
	MaximumCustomThemeDiscoveredGraphNodes,
	MaximumCustomThemeInitialCodeBytes,
	MaximumCustomThemePackageBytes,
	type CustomThemeReferenceRenderEvidenceV0,
} from "@rezics/block";
import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";

import { CustomThemeExternalResourceInvalid } from "../api/custom-themes/errors";
import { database } from "../database";
import { env } from "../config";
import {
	customThemeRevision,
	customThemeRevisionExternalResource,
	customThemeRevisionFile,
	customThemeRevisionReviewEvent,
} from "../database/schema";
import { canonicalRevisionJson } from "../history/content";
import { storage } from "../storage";
import {
	discoverExternalDependencies,
	fetchReviewedExternalResource,
	inspectCustomThemeLicenseSignals,
	type ReviewedResourceFetch,
} from "./external-resources";
import {
	deleteCustomThemeReferenceRenderArtifacts,
	generateCustomThemeReferenceRenderEvidence,
	type ReferenceRenderArtifactEvidence,
} from "./reference-render";
import {
	customThemeObservedRuntimeOriginsAreCovered,
	customThemeReferenceRenderEvidenceIsComplete,
	parseStoredCustomThemeManifest,
} from "./service";

// 512 nodes at eight-way concurrency and the absolute 10 s fetch bound can
// consume about 11 minutes before Browser Rendering and persistence.
const AutomatedReviewLeaseMilliseconds = 15 * 60_000;
const MaximumDependencyDepth = 8;
const MaximumConcurrentFetches = 8;
const MaximumConcurrentFetchesPerOrigin = 2;
export const MaximumCustomThemeReviewGraphBytes = 64 * 1_024 * 1_024;

interface ReviewNode {
	readonly resourceKey: string;
	readonly role: string;
	readonly url: string;
	readonly integrity: string | null;
	readonly integrityWaiverReason: string | null;
	readonly depth: number;
	readonly discoveredFrom: string | null;
	readonly required: boolean;
}

interface ReviewedNode extends ReviewNode {
	readonly fetched: ReviewedResourceFetch;
}

interface PackagedReviewSource {
	readonly resourceKey: string;
	readonly path: string;
	readonly role: string;
	readonly bytes: Uint8Array;
	readonly contentType: string;
	readonly baseUrl: string;
	readonly required: boolean;
}

export function selectCustomThemeReviewBatch<T extends { readonly url: string }>(
	queue: readonly T[],
): readonly T[] {
	const batch: T[] = [];
	const originCounts = new Map<string, number>();
	for (const candidate of queue) {
		if (batch.length >= MaximumConcurrentFetches) break;
		const origin = new URL(candidate.url).origin;
		const count = originCounts.get(origin) ?? 0;
		if (count >= MaximumConcurrentFetchesPerOrigin) continue;
		batch.push(candidate);
		originCounts.set(origin, count + 1);
	}
	return batch;
}

function sha256(value: unknown): string {
	return createHash("sha256").update(canonicalRevisionJson(value)).digest("hex");
}

function resourceKey(prefix: string, value: string): string {
	return `${prefix}:${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

async function readStoredFile(storageKey: string): Promise<Uint8Array> {
	const object = await storage.get({ Key: storageKey });
	const bytes = await object.Body?.transformToByteArray();
	if (!bytes) throw new Error("Custom Theme package object has no body");
	return bytes;
}

function directNodes(manifest: ReturnType<typeof parseStoredCustomThemeManifest>): ReviewNode[] {
	return [
		...manifest.styles.flatMap(({ source }, index) =>
			source.kind === "external"
				? [
						{
							resourceKey: `style:${index}`,
							role: "style_direct",
							url: source.url,
							integrity: source.integrity ?? null,
							integrityWaiverReason: source.integrityWaiverReason ?? null,
							depth: 0,
							discoveredFrom: null,
							required: manifest.styles[index]?.required ?? true,
						},
					]
				: [],
		),
		...manifest.scripts.flatMap(({ source, role }, index) =>
			source.kind === "external"
				? [
						{
							resourceKey: `script:${index}`,
							role: role === "module_entry" ? "module_entry_direct" : "classic_script_direct",
							url: source.url,
							integrity: source.integrity ?? null,
							integrityWaiverReason: source.integrityWaiverReason ?? null,
							depth: 0,
							discoveredFrom: null,
							required: manifest.scripts[index]?.required ?? true,
						},
					]
				: [],
		),
	];
}

function discoveryRole(kind: string): string {
	if (kind === "css_import") return "css_import";
	if (kind === "static_module_import" || kind === "dynamic_module_import")
		return "module_dependency";
	if (kind === "import_map_module") return "module_dependency";
	if (kind === "module_url") return "module_dependency";
	if (kind === "worker" || kind === "worker_import") return "worker_dependency";
	if (kind === "wasm") return "wasm_dependency";
	return kind;
}

async function fetchGraph(
	initial: readonly ReviewNode[],
	packagedSources: readonly PackagedReviewSource[],
): Promise<readonly ReviewedNode[]> {
	const queue = [...initial];
	const reviewed: ReviewedNode[] = [];
	const knownUrls = new Set(initial.map(({ url }) => url));
	let fetchedGraphBytes = 0;
	for (const packaged of packagedSources) {
		for (const dependency of discoverExternalDependencies(
			packaged.bytes,
			packaged.contentType,
			packaged.baseUrl,
		)) {
			if (knownUrls.has(dependency.url)) continue;
			knownUrls.add(dependency.url);
			queue.push({
				resourceKey: resourceKey(
					"packaged",
					`${packaged.resourceKey}:${dependency.kind}:${dependency.url}`,
				),
				role: discoveryRole(dependency.kind),
				url: dependency.url,
				integrity: dependency.integrity ?? null,
				integrityWaiverReason: dependency.integrity
					? null
					: "Transitively discovered dependency has no direct v0 SRI declaration",
				depth: 1,
				discoveredFrom: packaged.resourceKey,
				required: packaged.required,
			});
		}
	}
	while (queue.length) {
		if (knownUrls.size > MaximumCustomThemeDiscoveredGraphNodes)
			throw new CustomThemeExternalResourceInvalid({ reason: "dependency_graph_too_large" });
		const batch = selectCustomThemeReviewBatch(queue);
		if (!batch.length) throw new Error("Custom Theme review scheduler made no progress");
		for (const node of batch) queue.splice(queue.indexOf(node), 1);
		const fetchedBatch = await Promise.all(
			batch.map(
				async (node): Promise<ReviewedNode> => ({
					...node,
					fetched: await fetchReviewedExternalResource(node.url, {
						role: node.role,
						integrity: node.integrity,
						integrityWaiverReason: node.integrityWaiverReason,
						allowedCorsOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
					}),
				}),
			),
		);
		fetchedGraphBytes += fetchedBatch.reduce(
			(total, { fetched }) => total + fetched.observedByteLength,
			0,
		);
		if (fetchedGraphBytes > MaximumCustomThemeReviewGraphBytes)
			throw new CustomThemeExternalResourceInvalid({ reason: "dependency_graph_bytes_too_large" });
		for (const node of fetchedBatch) {
			reviewed.push(node);
			if (node.depth >= MaximumDependencyDepth) continue;
			for (const dependency of discoverExternalDependencies(
				node.fetched.bytes,
				node.fetched.observedContentType,
				node.fetched.finalUrl,
			)) {
				if (knownUrls.has(dependency.url)) continue;
				knownUrls.add(dependency.url);
				queue.push({
					resourceKey: resourceKey(
						"discovered",
						`${node.resourceKey}:${dependency.kind}:${dependency.url}`,
					),
					role: discoveryRole(dependency.kind),
					url: dependency.url,
					integrity: dependency.integrity ?? null,
					integrityWaiverReason: dependency.integrity
						? null
						: "Transitively discovered dependency has no direct v0 SRI declaration",
					depth: node.depth + 1,
					discoveredFrom: node.resourceKey,
					required: node.required,
				});
			}
		}
	}
	return reviewed;
}

async function claimRevisionBatch(limit: number) {
	return database.transaction(async (tx) => {
		const now = new Date();
		const rows = await tx
			.select()
			.from(customThemeRevision)
			.where(
				and(
					inArray(customThemeRevision.reviewState, ["pending_automated", "revalidation_required"]),
					lte(customThemeRevision.nextAutomatedReviewAt, now),
					or(
						isNull(customThemeRevision.automatedReviewLeaseUntil),
						lt(customThemeRevision.automatedReviewLeaseUntil, now),
					),
				),
			)
			.orderBy(asc(customThemeRevision.nextAutomatedReviewAt), asc(customThemeRevision.id))
			.limit(limit)
			.for("update", { skipLocked: true });
		if (!rows.length) return [];
		const leaseUntil = new Date(now.getTime() + AutomatedReviewLeaseMilliseconds);
		for (const row of rows)
			await tx
				.update(customThemeRevision)
				.set({
					automatedReviewLeaseUntil: leaseUntil,
					automatedReviewAttempts: row.automatedReviewAttempts + 1,
				})
				.where(eq(customThemeRevision.id, row.id));
		return rows.map((row) => ({ ...row, automatedReviewLeaseUntil: leaseUntil }));
	});
}

async function reviewRevision(revision: typeof customThemeRevision.$inferSelect): Promise<void> {
	const manifest = parseStoredCustomThemeManifest(revision.manifestDocument);
	const fileRows = await database
		.select()
		.from(customThemeRevisionFile)
		.where(eq(customThemeRevisionFile.revisionId, revision.id));
	const requiredPackagedPaths = new Set([
		...manifest.fragments.map(({ source }) => source.path),
		...manifest.styles.flatMap(({ source }) => (source.kind === "packaged" ? [source.path] : [])),
		...manifest.scripts.flatMap(({ source }) => (source.kind === "packaged" ? [source.path] : [])),
	]);
	const initialPackagedRows = fileRows.filter(({ path }) => requiredPackagedPaths.has(path));
	const packagedRequirements = new Map<string, boolean>(
		manifest.fragments.map(({ source }) => [source.path, true] as const),
	);
	for (const item of [...manifest.styles, ...manifest.scripts])
		if (item.source.kind === "packaged")
			packagedRequirements.set(
				item.source.path,
				(packagedRequirements.get(item.source.path) ?? false) || item.required,
			);
	const runtimeFileRows = fileRows.filter(
		({ role }) => !["manifest", "source_archive"].includes(role),
	);
	let reviewedNodes: readonly ReviewedNode[] = [];
	let automatedStatus: "passed" | "failed" = "passed";
	let failure: Record<string, unknown> | null = null;
	let referenceRender: CustomThemeReferenceRenderEvidenceV0 | null = null;
	let referenceRenderArtifacts: readonly ReferenceRenderArtifactEvidence[] = [];
	const licenseSignals: { readonly resourceKey: string; readonly signals: readonly string[] }[] =
		[];
	let licenseSignalsTruncated = false;
	const recordLicenseSignals = (resourceKey: string, signals: readonly string[]): void => {
		if (!signals.length) return;
		if (licenseSignals.length >= 256) {
			licenseSignalsTruncated = true;
			return;
		}
		licenseSignals.push({ resourceKey, signals });
	};
	try {
		if (
			runtimeFileRows.reduce((total, { byteLength }) => total + byteLength, 0) >
			MaximumCustomThemePackageBytes
		)
			throw new CustomThemeExternalResourceInvalid({ reason: "package_too_large" });
		const packagedFiles: readonly PackagedReviewSource[] = await Promise.all(
			runtimeFileRows.map(async (file) => ({
				resourceKey: `packaged:${file.path}`,
				path: file.path,
				role: file.role,
				bytes: await readStoredFile(file.storageKey),
				contentType: file.contentType,
				baseUrl: `https://packaged.invalid/${encodeURIComponent(file.path)}`,
				required: packagedRequirements.get(file.path) ?? true,
			})),
		);
		for (const source of packagedFiles) {
			const inspection = inspectCustomThemeLicenseSignals(source.bytes);
			recordLicenseSignals(source.resourceKey, inspection.signals);
			if (inspection.explicitlyUnlicensed)
				throw new CustomThemeExternalResourceInvalid({
					reason: "explicitly_unlicensed_dependency",
					resourceKey: source.resourceKey,
				});
		}
		const packagedSources = packagedFiles.filter(({ role }) =>
			["css", "js", "worker"].includes(role),
		);
		reviewedNodes = await fetchGraph(directNodes(manifest), packagedSources);
		for (const node of reviewedNodes) {
			const inspection = inspectCustomThemeLicenseSignals(node.fetched.bytes);
			recordLicenseSignals(node.resourceKey, inspection.signals);
			if (inspection.explicitlyUnlicensed)
				throw new CustomThemeExternalResourceInvalid({
					reason: "explicitly_unlicensed_dependency",
					resourceKey: node.resourceKey,
				});
			if (
				(node.integrity !== null || node.role.includes("module")) &&
				!node.fetched.corsAllowsAnonymous
			)
				throw new CustomThemeExternalResourceInvalid({
					reason: node.role.includes("module")
						? "module_resource_requires_anonymous_cors"
						: "integrity_resource_requires_anonymous_cors",
					resourceKey: node.resourceKey,
				});
		}
		const initialExternalBytes = reviewedNodes
			.filter(({ role }) =>
				[
					"style_direct",
					"classic_script_direct",
					"module_entry_direct",
					"css_import",
					"module_dependency",
				].includes(role),
			)
			.reduce((total, { fetched }) => total + fetched.observedByteLength, 0);
		const packagedCodeBytes = initialPackagedRows
			.filter(({ role }) => role === "css" || role === "js")
			.reduce((total, { byteLength }) => total + byteLength, 0);
		if (initialExternalBytes + packagedCodeBytes > MaximumCustomThemeInitialCodeBytes)
			throw new CustomThemeExternalResourceInvalid({ reason: "initial_code_too_large" });
		const packagedByPath = new Map(packagedFiles.map((file) => [file.path, file]));
		const renderResult = await generateCustomThemeReferenceRenderEvidence({
			themeUnitId: revision.customThemeUnitId,
			revisionId: revision.id,
			manifest,
			files: runtimeFileRows.map((file) => {
				const source = packagedByPath.get(file.path);
				if (!source)
					throw new CustomThemeExternalResourceInvalid({
						reason: "reference_render_file_missing",
						path: file.path,
					});
				return {
					path: file.path,
					contentType: file.contentType,
					sha256: file.sha256,
					storageKey: file.storageKey,
					bytes: source.bytes,
				};
			}),
			reviewedUrls: reviewedNodes.flatMap(({ fetched }) => [
				fetched.requestedUrl,
				fetched.finalUrl,
				...fetched.redirectChain,
			]),
		});
		referenceRender = renderResult.evidence;
		referenceRenderArtifacts = renderResult.artifacts;
		if (
			!customThemeReferenceRenderEvidenceIsComplete(referenceRender) ||
			!customThemeObservedRuntimeOriginsAreCovered(manifest, referenceRender)
		)
			throw new CustomThemeExternalResourceInvalid({ reason: "reference_render_failed" });
	} catch (error) {
		automatedStatus = "failed";
		failure =
			error instanceof CustomThemeExternalResourceInvalid
				? { code: error.type, details: error.details ?? null }
				: {
						code: "review_failed",
						message: error instanceof Error ? error.message : String(error),
					};
	}
	const reviewedAt = new Date();
	const evidence = {
		automatedStatus,
		reviewedAt: reviewedAt.toISOString(),
		targetContract: revision.targetContract,
		resourceMode: revision.resourceMode,
		directResourceCount: directNodes(manifest).length,
		graphNodeCount: reviewedNodes.length,
		packageFileCount: fileRows.length,
		licenseSignals: licenseSignals.slice(0, 256),
		licenseSignalsTruncated,
		referenceRender,
		referenceRenderArtifacts,
		failure,
		declaredRuntimeOrigins: manifest.declaredRuntimeOrigins,
		limitations: [
			"Static and bounded dependency discovery is evidence, not proof of an immutable closure.",
			"Approved code may compute new destinations or mutate browser-global state at runtime.",
		],
	};
	const evidenceSha256 = sha256(evidence);
	const evidencePersisted = await database.transaction(async (tx) => {
		const [current] = await tx
			.select({
				state: customThemeRevision.reviewState,
				leaseUntil: customThemeRevision.automatedReviewLeaseUntil,
			})
			.from(customThemeRevision)
			.where(eq(customThemeRevision.id, revision.id))
			.limit(1)
			.for("update");
		if (
			!current ||
			!current.leaseUntil ||
			current.leaseUntil.getTime() !== revision.automatedReviewLeaseUntil?.getTime() ||
			(current.state !== "pending_automated" && current.state !== "revalidation_required")
		)
			return false;
		await tx
			.delete(customThemeRevisionExternalResource)
			.where(eq(customThemeRevisionExternalResource.revisionId, revision.id));
		if (reviewedNodes.length)
			await tx.insert(customThemeRevisionExternalResource).values(
				reviewedNodes.map(
					({
						resourceKey,
						role,
						integrity,
						integrityWaiverReason,
						depth,
						discoveredFrom,
						required,
						fetched,
					}) => ({
						revisionId: revision.id,
						resourceKey,
						role,
						requestedUrl: fetched.requestedUrl,
						finalUrl: fetched.finalUrl,
						origin: new URL(fetched.finalUrl).origin,
						observedSha256: fetched.observedSha256,
						observedByteLength: fetched.observedByteLength,
						observedContentType: fetched.observedContentType,
						integrityMetadata: integrity,
						integrityWaiverReason,
						corsAllowsAnonymous: fetched.corsAllowsAnonymous,
						observedAt: new Date(fetched.observedAt),
						currentHealthState: "current" as const,
						lastCheckedAt: reviewedAt,
						nextCheckAt: new Date(
							reviewedAt.getTime() + (integrity ? 24 * 60 * 60_000 : 5 * 60_000),
						),
						reviewEvidence: {
							redirectChain: [...fetched.redirectChain],
							depth,
							discoveredFrom,
							required,
						},
					}),
				),
			);
		const isRevalidation = revision.reviewState === "revalidation_required";
		await tx
			.update(customThemeRevision)
			.set({
				reviewState: isRevalidation ? "revalidation_required" : "pending_human",
				reviewEvidence: evidence,
				reviewEvidenceSha256: evidenceSha256,
				automatedReviewLeaseUntil: null,
				...(isRevalidation
					? {}
					: {
							reviewedByProfileId: null,
							reviewedAt: null,
							approvedHostUnitId: null,
							decisionReason: null,
						}),
				killedByProfileId: null,
				killedAt: null,
			})
			.where(eq(customThemeRevision.id, revision.id));
		await tx.insert(customThemeRevisionReviewEvent).values({
			revisionId: revision.id,
			kind: isRevalidation ? "revalidation" : "automated",
			actorProfileId: null,
			evidence,
			evidenceSha256,
		});
		return true;
	});
	if (!evidencePersisted && referenceRenderArtifacts.length)
		await deleteCustomThemeReferenceRenderArtifacts({
			themeUnitId: revision.customThemeUnitId,
			revisionId: revision.id,
			artifacts: referenceRenderArtifacts,
		});
}

export async function reviewPendingCustomThemeRevisionBatch(limit = 4): Promise<number> {
	const revisions = await claimRevisionBatch(Math.max(1, Math.min(limit, 16)));
	await Promise.all(revisions.map(reviewRevision));
	return revisions.length;
}
