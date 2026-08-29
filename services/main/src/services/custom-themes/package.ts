import { createHash } from "node:crypto";

import {
	MaximumCustomThemeDirectExternalResources,
	MaximumCustomThemeFragmentBytes,
	MaximumCustomThemeInitialCodeBytes,
	MaximumCustomThemePackageBytes,
	type CustomThemeRevisionFileRole,
	type SubmittedCustomThemeManifestV0,
} from "@rezics/block";

import { CustomThemePackageInvalid } from "../api/custom-themes/errors";
import { canonicalRevisionJson } from "../history/content";

export const MaximumCustomThemeSourceArchiveBytes = 20 * 1_024 * 1_024;
export const MaximumCustomThemePackageFiles = 256;

export interface SubmittedCustomThemeFileInput {
	readonly path: string;
	readonly role: Exclude<CustomThemeRevisionFileRole, "manifest" | "source_archive">;
	readonly contentType: string;
	readonly contentBase64: string;
}

export interface ValidatedCustomThemeFile {
	readonly path: string;
	readonly role: CustomThemeRevisionFileRole;
	readonly contentType: string;
	readonly bytes: Uint8Array;
	readonly sha256: string;
}

export interface ValidatedCustomThemePackage {
	readonly manifest: SubmittedCustomThemeManifestV0;
	readonly manifestSha256: string;
	readonly sourceArchiveSha256: string;
	readonly files: readonly ValidatedCustomThemeFile[];
}

function packageInvalid(reason: string, path?: string): CustomThemePackageInvalid {
	return new CustomThemePackageInvalid({ reason, ...(path ? { path } : {}) });
}

export function isSafeCustomThemePackagePath(path: string): boolean {
	return (
		path.length > 0 &&
		path.length <= 512 &&
		!path.startsWith("/") &&
		!path.includes("\\") &&
		!path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
	);
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

function isSyntacticallyValidBase64(value: string): boolean {
	if (value.length % 4 !== 0) return false;
	const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
	const contentLength = value.length - padding;
	for (let index = 0; index < contentLength; index += 1)
		if (!isBase64Alphabet(value.charCodeAt(index))) return false;
	for (let index = contentLength; index < value.length; index += 1)
		if (value.charCodeAt(index) !== 0x3d) return false;
	return true;
}

function decodeBase64(value: string, maximumBytes: number, path: string): Uint8Array {
	if (!isSyntacticallyValidBase64(value)) throw packageInvalid("invalid_base64", path);
	const bytes = Buffer.from(value, "base64");
	if (bytes.byteLength > maximumBytes) throw packageInvalid("file_too_large", path);
	return bytes;
}

function normalizedContentType(value: string): string {
	return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function validateRoleContentType(
	role: CustomThemeRevisionFileRole,
	contentType: string,
	path: string,
) {
	const normalized = normalizedContentType(contentType);
	const allowed: Readonly<Record<CustomThemeRevisionFileRole, readonly string[]>> = {
		manifest: ["application/json"],
		source_archive: ["application/zip", "application/x-tar", "application/gzip"],
		html: ["text/html"],
		css: ["text/css"],
		js: ["application/javascript", "text/javascript", "application/ecmascript", "text/ecmascript"],
		worker: [
			"application/javascript",
			"text/javascript",
			"application/ecmascript",
			"text/ecmascript",
		],
		wasm: ["application/wasm"],
		font: ["font/woff", "font/woff2", "font/ttf", "font/otf", "application/font-woff"],
		svg: ["image/svg+xml"],
		asset: [
			"image/png",
			"image/jpeg",
			"image/webp",
			"image/avif",
			"image/gif",
			"audio/mpeg",
			"video/mp4",
			"application/octet-stream",
		],
	};
	if (!allowed[role].includes(normalized)) throw packageInvalid("content_type_role_mismatch", path);
}

function sha256(bytes: Uint8Array | string): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function decodeUtf8(bytes: Uint8Array, path: string): string {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw packageInvalid("text_file_must_be_utf8", path);
	}
}

function validateManagedFragment(bytes: Uint8Array, path: string): void {
	const markup = decodeUtf8(bytes, path);
	const forbiddenElement = /<\s*(?:script|style|link|base|meta|object|embed)(?:\s|\/?>)/iu;
	const inlineEventHandler = /(?:^|\s)on[a-z][a-z0-9_:.-]*\s*=/iu;
	const executableUrl = /(?:href|src|action|formaction)\s*=\s*["']?\s*javascript\s*:/iu;
	const inlineFrameDocument = /<\s*iframe\b[^>]*\bsrcdoc\s*=/iu;
	if (
		forbiddenElement.test(markup) ||
		inlineEventHandler.test(markup) ||
		executableUrl.test(markup) ||
		inlineFrameDocument.test(markup)
	)
		throw packageInvalid("fragment_executable_content_must_be_manifest_managed", path);
}

function validateSourceArchive(bytes: Uint8Array, contentType: string): void {
	const type = normalizedContentType(contentType);
	const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
	const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
	const tar =
		bytes.byteLength >= 262 && new TextDecoder().decode(bytes.subarray(257, 262)) === "ustar";
	if (
		(type === "application/zip" && !zip) ||
		(type === "application/gzip" && !gzip) ||
		(type === "application/x-tar" && !tar)
	)
		throw packageInvalid("source_archive_content_mismatch", "source-archive");
}

function packagedPaths(manifest: SubmittedCustomThemeManifestV0): readonly {
	readonly path: string;
	readonly expectedRole: "html" | "css" | "js";
}[] {
	return [
		...manifest.fragments.map(({ source }) => ({
			path: source.path,
			expectedRole: "html" as const,
		})),
		...manifest.styles.flatMap(({ source }) =>
			source.kind === "packaged" ? [{ path: source.path, expectedRole: "css" as const }] : [],
		),
		...manifest.scripts.flatMap(({ source }) =>
			source.kind === "packaged" ? [{ path: source.path, expectedRole: "js" as const }] : [],
		),
	];
}

function isExactHttpsOrigin(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && value === url.origin;
	} catch {
		return false;
	}
}

function isReviewableExternalHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return Boolean(
			url.protocol === "https:" &&
				url.hostname &&
				!url.username &&
				!url.password &&
				!url.hash &&
				(!url.port || url.port === "443"),
		);
	} catch {
		return false;
	}
}

export function validateSubmittedCustomThemePackage(input: {
	readonly manifest: SubmittedCustomThemeManifestV0;
	readonly files: readonly SubmittedCustomThemeFileInput[];
	readonly sourceArchive: { readonly contentType: string; readonly contentBase64: string };
}): ValidatedCustomThemePackage {
	if (input.files.length > MaximumCustomThemePackageFiles) throw packageInvalid("too_many_files");
	const moduleEntrypoints = input.manifest.scripts.filter(({ role }) => role === "module_entry");
	if (moduleEntrypoints.length !== 1) throw packageInvalid("exactly_one_module_entry_required");
	if (!moduleEntrypoints[0]?.required) throw packageInvalid("module_entry_must_be_required");
	const orders = input.manifest.scripts.map(({ order }) => order);
	if (
		new Set(orders).size !== orders.length ||
		[...orders].sort((left, right) => left - right).some((order, index) => order !== index)
	)
		throw packageInvalid("script_order_must_be_contiguous");
	if (moduleEntrypoints[0]?.order !== input.manifest.scripts.length - 1)
		throw packageInvalid("module_entry_must_be_last");
	if (
		new Set(input.manifest.fragments.map(({ slot }) => slot)).size !==
		input.manifest.fragments.length
	)
		throw packageInvalid("fragment_slots_must_be_unique");
	for (const origins of Object.values(input.manifest.declaredRuntimeOrigins))
		for (const origin of origins)
			if (!isExactHttpsOrigin(origin)) throw packageInvalid("runtime_origin_invalid", origin);
	const externalResources = [
		...input.manifest.styles.map(({ source }) => source),
		...input.manifest.scripts.map(({ source }) => source),
	].filter((source) => source.kind === "external");
	if (externalResources.length > MaximumCustomThemeDirectExternalResources)
		throw packageInvalid("too_many_direct_external_resources");
	for (const resource of externalResources) {
		if (!isReviewableExternalHttpsUrl(resource.url))
			throw packageInvalid("external_resource_url_invalid", resource.url);
		if (Boolean(resource.integrity) === Boolean(resource.integrityWaiverReason))
			throw packageInvalid("external_resource_requires_integrity_or_waiver", resource.url);
		if (resource.integrityWaiverReason !== undefined && !resource.integrityWaiverReason.trim())
			throw packageInvalid("external_resource_waiver_empty", resource.url);
	}

	const files: ValidatedCustomThemeFile[] = [];
	const byPath = new Map<string, ValidatedCustomThemeFile>();
	let packageBytes = 0;
	for (const file of input.files) {
		if (!isSafeCustomThemePackagePath(file.path)) throw packageInvalid("unsafe_path", file.path);
		if (byPath.has(file.path)) throw packageInvalid("duplicate_path", file.path);
		validateRoleContentType(file.role, file.contentType, file.path);
		const bytes = decodeBase64(file.contentBase64, MaximumCustomThemeInitialCodeBytes, file.path);
		packageBytes += bytes.byteLength;
		if (packageBytes > MaximumCustomThemePackageBytes) throw packageInvalid("package_too_large");
		if (file.role === "html") validateManagedFragment(bytes, file.path);
		if (file.role === "css" || file.role === "js" || file.role === "worker")
			decodeUtf8(bytes, file.path);
		const validated = { ...file, bytes, sha256: sha256(bytes) };
		files.push(validated);
		byPath.set(file.path, validated);
	}
	for (const reference of packagedPaths(input.manifest)) {
		const file = byPath.get(reference.path);
		if (!file) throw packageInvalid("packaged_reference_missing", reference.path);
		if (file.role !== reference.expectedRole)
			throw packageInvalid("packaged_reference_role_mismatch", reference.path);
	}
	const fragmentBytes = input.manifest.fragments.reduce(
		(total, { source }) => total + (byPath.get(source.path)?.bytes.byteLength ?? 0),
		0,
	);
	if (fragmentBytes > MaximumCustomThemeFragmentBytes) throw packageInvalid("fragments_too_large");
	const packagedInitialCodeBytes = input.manifest.styles.reduce(
		(total, { source }) =>
			total + (source.kind === "packaged" ? (byPath.get(source.path)?.bytes.byteLength ?? 0) : 0),
		input.manifest.scripts.reduce(
			(total, { source }) =>
				total + (source.kind === "packaged" ? (byPath.get(source.path)?.bytes.byteLength ?? 0) : 0),
			0,
		),
	);
	if (packagedInitialCodeBytes > MaximumCustomThemeInitialCodeBytes)
		throw packageInvalid("initial_code_too_large");

	const manifestJson = canonicalRevisionJson(input.manifest);
	const manifestBytes = Buffer.from(manifestJson);
	const sourceArchiveBytes = decodeBase64(
		input.sourceArchive.contentBase64,
		MaximumCustomThemeSourceArchiveBytes,
		"source-archive",
	);
	validateRoleContentType("source_archive", input.sourceArchive.contentType, "source-archive");
	validateSourceArchive(sourceArchiveBytes, input.sourceArchive.contentType);
	files.push({
		path: "rezics-theme-manifest.json",
		role: "manifest",
		contentType: "application/json",
		bytes: manifestBytes,
		sha256: sha256(manifestBytes),
	});
	files.push({
		path: "source-archive",
		role: "source_archive",
		contentType: input.sourceArchive.contentType,
		bytes: sourceArchiveBytes,
		sha256: sha256(sourceArchiveBytes),
	});
	return {
		manifest: input.manifest,
		manifestSha256: sha256(manifestBytes),
		sourceArchiveSha256: sha256(sourceArchiveBytes),
		files,
	};
}
