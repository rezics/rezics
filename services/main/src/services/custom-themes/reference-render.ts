import { createHash, randomUUID } from "node:crypto";

import {
	CustomThemeReferenceRenderEvidenceV0,
	CustomThemeReferenceRenderResultV0,
	MaximumCustomThemeReferenceRenderScreenshotBytes,
	isDocument,
	type CustomThemeReferenceRenderRequestV0,
	type SubmittedCustomThemeManifestV0,
} from "@rezics/block";
import { and, eq } from "drizzle-orm";

import { CustomThemeRevisionNotFound } from "../api/custom-themes/errors";
import { env } from "../config";
import { database } from "../database";
import { customThemeRevision } from "../database/schema";
import { storage } from "../storage";

const ReferenceRenderResponseBytes = 32 * 1_024 * 1_024;
const ReferenceRenderTimeoutMilliseconds = 60_000;
const PngSignature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface ReferenceRenderPackageFile {
	readonly bytes: Uint8Array;
	readonly contentType: string;
	readonly path: string;
	readonly sha256: string;
	readonly storageKey: string;
}

export interface ReferenceRenderArtifactEvidence {
	readonly byteLength: number;
	readonly screenshotAssetId: string;
	readonly sha256: string;
}

export interface ReferenceRenderDependencies {
	readonly delete: typeof storage.delete;
	readonly fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
	readonly presignGet: typeof storage.presignGet;
	readonly put: typeof storage.put;
	readonly randomUuid: () => string;
	readonly rendererToken: string | undefined;
	readonly rendererUrl: string | undefined;
}

const defaultDependencies: ReferenceRenderDependencies = {
	delete: storage.delete,
	fetch,
	presignGet: storage.presignGet,
	put: storage.put,
	randomUuid: randomUUID,
	rendererToken: env.CUSTOM_THEME_REFERENCE_RENDER_TOKEN,
	rendererUrl: env.CUSTOM_THEME_REFERENCE_RENDERER_URL,
};

function referenceRenderInvalid(reason: string): Error {
	return new Error(`Custom Theme reference render invalid: ${reason}`);
}

function isBase64Alphabet(code: number): boolean {
	return (
		(code >= 0x41 && code <= 0x5a) ||
		(code >= 0x61 && code <= 0x7a) ||
		(code >= 0x30 && code <= 0x39) ||
		code === 0x2b ||
		code === 0x2f
	);
}

function decodeScreenshot(value: string): Uint8Array {
	if (value.length % 4 !== 0) throw referenceRenderInvalid("screenshot_base64_invalid");
	const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
	const contentLength = value.length - padding;
	for (let index = 0; index < contentLength; index += 1)
		if (!isBase64Alphabet(value.charCodeAt(index)))
			throw referenceRenderInvalid("screenshot_base64_invalid");
	for (let index = contentLength; index < value.length; index += 1)
		if (value.charCodeAt(index) !== 0x3d) throw referenceRenderInvalid("screenshot_base64_invalid");
	const bytes = Buffer.from(value, "base64");
	if (!bytes.length || bytes.byteLength > MaximumCustomThemeReferenceRenderScreenshotBytes)
		throw referenceRenderInvalid("screenshot_size_invalid");
	if (PngSignature.some((byte, index) => bytes[index] !== byte))
		throw referenceRenderInvalid("screenshot_type_invalid");
	return bytes;
}

async function readBoundedResponse(response: Response): Promise<Uint8Array> {
	const declaredLength = Number(response.headers.get("content-length") ?? 0);
	if (Number.isFinite(declaredLength) && declaredLength > ReferenceRenderResponseBytes)
		throw referenceRenderInvalid("response_too_large");
	if (!response.body) throw referenceRenderInvalid("response_body_missing");
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		byteLength += value.byteLength;
		if (byteLength > ReferenceRenderResponseBytes) {
			await reader.cancel();
			throw referenceRenderInvalid("response_too_large");
		}
		chunks.push(value);
	}
	const result = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}

function fragmentMarkup(
	manifest: SubmittedCustomThemeManifestV0,
	files: ReadonlyMap<string, ReferenceRenderPackageFile>,
	slot: "header.append" | "footer.append",
): string {
	const fragment = manifest.fragments.find((candidate) => candidate.slot === slot);
	if (!fragment) return "";
	const file = files.get(fragment.source.path);
	if (!file) throw referenceRenderInvalid("fragment_missing");
	return new TextDecoder("utf-8", { fatal: false }).decode(file.bytes);
}

function exactHttpsOrigin(value: string): string {
	const url = new URL(value);
	if (url.protocol !== "https:") throw referenceRenderInvalid("https_origin_required");
	return url.origin;
}

export function customThemeReferenceRenderArtifactStorageKey(
	themeUnitId: string,
	revisionId: string,
	assetId: string,
): string {
	return `custom-themes/${themeUnitId}/${revisionId}/reference-renders/${assetId}.png`;
}

export async function deleteCustomThemeReferenceRenderArtifacts(input: {
	readonly themeUnitId: string;
	readonly revisionId: string;
	readonly artifacts: readonly ReferenceRenderArtifactEvidence[];
}): Promise<void> {
	const results = await Promise.allSettled(
		input.artifacts.map(({ screenshotAssetId }) =>
			storage.delete({
				Key: customThemeReferenceRenderArtifactStorageKey(
					input.themeUnitId,
					input.revisionId,
					screenshotAssetId,
				),
			}),
		),
	);
	const failureCount = results.filter(({ status }) => status === "rejected").length;
	if (failureCount)
		console.error(
			JSON.stringify({
				event: "custom_theme_reference_render_artifact_cleanup_failed",
				failureCount,
				revisionId: input.revisionId,
			}),
		);
}

export async function getCustomThemeReferenceRenderArtifactLocation(input: {
	readonly themeUnitId: string;
	readonly revisionId: string;
	readonly screenshotAssetId: string;
}): Promise<string> {
	const [revision] = await database
		.select({ reviewEvidence: customThemeRevision.reviewEvidence })
		.from(customThemeRevision)
		.where(
			and(
				eq(customThemeRevision.id, input.revisionId),
				eq(customThemeRevision.customThemeUnitId, input.themeUnitId),
			),
		)
		.limit(1);
	const referenceRender = revision?.reviewEvidence?.referenceRender;
	if (
		!isDocument(CustomThemeReferenceRenderEvidenceV0, referenceRender) ||
		!referenceRender.fixtures.some(
			({ screenshotAssetId }) => screenshotAssetId === input.screenshotAssetId,
		)
	)
		throw new CustomThemeRevisionNotFound();
	return storage.presignGet({
		Key: customThemeReferenceRenderArtifactStorageKey(
			input.themeUnitId,
			input.revisionId,
			input.screenshotAssetId,
		),
	});
}

export async function generateCustomThemeReferenceRenderEvidence(
	input: {
		readonly themeUnitId: string;
		readonly revisionId: string;
		readonly manifest: SubmittedCustomThemeManifestV0;
		readonly files: readonly ReferenceRenderPackageFile[];
		readonly reviewedUrls: readonly string[];
	},
	dependencies: ReferenceRenderDependencies = defaultDependencies,
): Promise<{
	readonly artifacts: readonly ReferenceRenderArtifactEvidence[];
	readonly evidence: CustomThemeReferenceRenderEvidenceV0;
}> {
	if (!dependencies.rendererUrl || !dependencies.rendererToken)
		throw referenceRenderInvalid("renderer_unconfigured");
	const files = new Map(input.files.map((file) => [file.path, file]));
	const packagedResources = await Promise.all(
		input.files.map(async (file) => ({
			path: file.path,
			url: await dependencies.presignGet({ Key: file.storageKey }, 5 * 60),
			sha256: file.sha256,
			contentType: file.contentType,
		})),
	);
	const allowedOrigins = new Set<string>();
	for (const resource of packagedResources) allowedOrigins.add(exactHttpsOrigin(resource.url));
	for (const value of input.reviewedUrls) allowedOrigins.add(exactHttpsOrigin(value));
	for (const values of Object.values(input.manifest.declaredRuntimeOrigins))
		for (const value of values) allowedOrigins.add(exactHttpsOrigin(value));
	const requestBody = {
		revisionId: input.revisionId,
		manifest: input.manifest,
		packagedResources,
		headerMarkup: fragmentMarkup(input.manifest, files, "header.append"),
		footerMarkup: fragmentMarkup(input.manifest, files, "footer.append"),
		allowedOrigins: [...allowedOrigins].toSorted(),
	} satisfies CustomThemeReferenceRenderRequestV0;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), ReferenceRenderTimeoutMilliseconds);
	let response: Response;
	try {
		response = await dependencies.fetch(dependencies.rendererUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${dependencies.rendererToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
			redirect: "error",
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
	if (!response.ok) throw referenceRenderInvalid(`renderer_status_${response.status}`);
	const responseBytes = await readBoundedResponse(response);
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(responseBytes));
	} catch {
		throw referenceRenderInvalid("response_json_invalid");
	}
	if (!isDocument(CustomThemeReferenceRenderResultV0, parsed))
		throw referenceRenderInvalid("response_contract_invalid");
	const result: CustomThemeReferenceRenderResultV0 = parsed;
	const artifacts: ReferenceRenderArtifactEvidence[] = [];
	const fixtures: CustomThemeReferenceRenderEvidenceV0["fixtures"] = [];
	const storedKeys: string[] = [];
	try {
		for (const fixture of result.fixtures) {
			const screenshot = decodeScreenshot(fixture.screenshotBase64);
			const screenshotAssetId = dependencies.randomUuid();
			const sha256 = createHash("sha256").update(screenshot).digest("hex");
			const storageKey = customThemeReferenceRenderArtifactStorageKey(
				input.themeUnitId,
				input.revisionId,
				screenshotAssetId,
			);
			storedKeys.push(storageKey);
			await dependencies.put({
				Key: storageKey,
				Body: screenshot,
				ContentType: "image/png",
				ContentLength: screenshot.byteLength,
				CacheControl: "private, no-store",
				Metadata: {
					"revision-id": input.revisionId,
					"screenshot-asset-id": screenshotAssetId,
					sha256,
				},
			});
			const { screenshotBase64: _screenshotBase64, ...metrics } = fixture;
			fixtures.push({ ...metrics, screenshotAssetId });
			artifacts.push({ screenshotAssetId, sha256, byteLength: screenshot.byteLength });
		}
	} catch (error) {
		await Promise.allSettled(storedKeys.map((Key) => dependencies.delete({ Key })));
		throw error;
	}
	return {
		artifacts,
		evidence: {
			rendererVersion: result.rendererVersion,
			observedRuntimeOrigins: result.observedRuntimeOrigins,
			fixtures,
			accessibilityFindings: result.accessibilityFindings,
			cleanupPassed: result.cleanupPassed,
		},
	};
}
