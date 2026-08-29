import { MaximumCustomThemeResourceLoadMilliseconds } from "@rezics/block";

import type { ResolvedCustomTheme } from "./resolved-presentation";
import {
	emitUnitPresentationRuntimeEvent,
	type MountUnitPresentationV0,
	type UnitPresentationContextV0,
} from "./lifecycle";

type ManifestStyle = ResolvedCustomTheme["manifest"]["styles"][number];
type ManifestScript = ResolvedCustomTheme["manifest"]["scripts"][number];
type ManifestSource = ManifestStyle["source"] | ManifestScript["source"];
type PackagedFile = ResolvedCustomTheme["packagedFiles"][number];

interface RuntimeRoots {
	readonly header: HTMLElement;
	readonly headerFragment: HTMLElement;
	readonly main: HTMLElement;
	readonly footer: HTMLElement;
	readonly footerFragment: HTMLElement;
}

export interface HostFullTrustRuntimeOptions {
	readonly hostUnit: UnitPresentationContextV0["hostUnit"];
	readonly roots: RuntimeRoots;
	readonly theme: ResolvedCustomTheme;
	readonly onActive: () => void;
	readonly onPreExecutionFailure: () => void;
	readonly onPostExecutionFailure: () => void;
}

export interface HostFullTrustRuntimeHandle {
	dispose(): void;
}

export interface HostFullTrustRuntimeDependencies {
	readonly importModule?: (url: string) => Promise<unknown>;
}

class RuntimeFailure extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = "UnitPresentationRuntimeFailure";
	}
}

let activeRuntime: { readonly token: symbol; readonly dispose: () => void } | undefined;

function sourceKey(source: ManifestSource): string {
	return source.kind === "packaged" ? `packaged:${source.path}` : `external:${source.url}`;
}

function sha256Hex(bytes: ArrayBuffer): Promise<string> {
	return crypto.subtle
		.digest("SHA-256", bytes)
		.then((digest) =>
			Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
		);
}

function packagedFileByPath(theme: ResolvedCustomTheme): ReadonlyMap<string, PackagedFile> {
	return new Map(theme.packagedFiles.map((file) => [file.path, file]));
}

async function fetchPackagedFile(file: PackagedFile, signal: AbortSignal): Promise<ArrayBuffer> {
	const url = new URL(file.contentUrl, window.location.href);
	if (url.origin !== window.location.origin) throw new RuntimeFailure("packaged_origin_invalid");
	const response = await fetch(url, {
		cache: "no-store",
		credentials: "include",
		redirect: "error",
		signal,
	});
	if (!response.ok) throw new RuntimeFailure("packaged_fetch_failed");
	const bytes = await response.arrayBuffer();
	if ((await sha256Hex(bytes)) !== file.sha256)
		throw new RuntimeFailure("packaged_digest_mismatch");
	return bytes;
}

async function fetchPackagedResources(
	theme: ResolvedCustomTheme,
	signal: AbortSignal,
): Promise<{
	readonly values: ReadonlyMap<string, ArrayBuffer>;
	readonly unavailable: ReadonlySet<string>;
}> {
	const files = packagedFileByPath(theme);
	const requirements = new Map<string, boolean>();
	for (const fragment of theme.manifest.fragments) requirements.set(fragment.source.path, true);
	for (const style of theme.manifest.styles)
		if (style.source.kind === "packaged")
			requirements.set(
				style.source.path,
				(requirements.get(style.source.path) ?? false) || style.required,
			);
	for (const script of theme.manifest.scripts)
		if (script.source.kind === "packaged")
			requirements.set(
				script.source.path,
				(requirements.get(script.source.path) ?? false) || script.required,
			);
	const queue = [...requirements.keys()];
	const values = new Map<string, ArrayBuffer>();
	const unavailable = new Set<string>();
	const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
		while (!signal.aborted) {
			const path = queue.shift();
			if (!path) return;
			const file = files.get(path);
			try {
				if (!file) throw new RuntimeFailure("packaged_file_missing");
				values.set(path, await fetchPackagedFile(file, signal));
			} catch (error) {
				if (requirements.get(path)) throw error;
				unavailable.add(`packaged:${path}`);
			}
		}
	});
	await Promise.all(workers);
	return { values, unavailable };
}

function applyAnonymousRequestPolicy(
	element: HTMLLinkElement | HTMLScriptElement,
	source: Extract<ManifestSource, { readonly kind: "external" }>,
	theme: ResolvedCustomTheme,
	forceAnonymous = false,
): void {
	const evidence = theme.externalResources.find((resource) => resource.requestedUrl === source.url);
	if (forceAnonymous || source.integrity || evidence?.corsAllowsAnonymous)
		element.crossOrigin = "anonymous";
	element.referrerPolicy = "no-referrer";
	if (source.integrity) element.integrity = source.integrity;
}

function waitForElementLoad(
	element: HTMLLinkElement | HTMLScriptElement,
	signal: AbortSignal,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (failure?: RuntimeFailure) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			element.removeEventListener("load", loaded);
			element.removeEventListener("error", failed);
			signal.removeEventListener("abort", aborted);
			if (failure) reject(failure);
			else resolve();
		};
		const loaded = () => finish();
		const failed = () => finish(new RuntimeFailure("resource_load_failed"));
		const aborted = () => finish(new RuntimeFailure("runtime_aborted"));
		const timeout = window.setTimeout(
			() => finish(new RuntimeFailure("resource_load_timeout")),
			MaximumCustomThemeResourceLoadMilliseconds,
		);
		element.addEventListener("load", loaded, { once: true });
		element.addEventListener("error", failed, { once: true });
		signal.addEventListener("abort", aborted, { once: true });
	});
}

function createExternalPreload(
	theme: ResolvedCustomTheme,
	input:
		| { readonly kind: "style"; readonly source: Extract<ManifestSource, { kind: "external" }> }
		| {
				readonly kind: "script";
				readonly role: ManifestScript["role"];
				readonly source: Extract<ManifestSource, { kind: "external" }>;
		  },
): HTMLLinkElement {
	const link = document.createElement("link");
	if (input.kind === "script" && input.role === "module_entry") {
		link.rel = "modulepreload";
		applyAnonymousRequestPolicy(link, input.source, theme, true);
	} else {
		link.rel = "preload";
		link.as = input.kind;
		applyAnonymousRequestPolicy(link, input.source, theme);
	}
	link.href = input.source.url;
	link.dataset.unitPresentationPreload = theme.revisionId;
	return link;
}

async function preflightExternalResources(
	theme: ResolvedCustomTheme,
	signal: AbortSignal,
	elements: HTMLElement[],
): Promise<ReadonlySet<string>> {
	const resources = [
		...theme.manifest.styles
			.filter(
				(
					style,
				): style is ManifestStyle & { source: Extract<ManifestSource, { kind: "external" }> } =>
					style.source.kind === "external",
			)
			.map((style) => ({ kind: "style" as const, item: style })),
		...theme.manifest.scripts
			.filter(
				(
					script,
				): script is ManifestScript & {
					source: Extract<ManifestSource, { kind: "external" }>;
				} => script.source.kind === "external",
			)
			.map((script) => ({ kind: "script" as const, item: script })),
	];
	const unavailable = new Set<string>();
	await Promise.all(
		resources.map(async (resource) => {
			const link = createExternalPreload(
				theme,
				resource.kind === "style"
					? { kind: "style", source: resource.item.source }
					: {
							kind: "script",
							role: resource.item.role,
							source: resource.item.source,
						},
			);
			elements.push(link);
			document.head.append(link);
			try {
				await waitForElementLoad(link, signal);
			} catch (error) {
				if (resource.item.required) throw error;
				unavailable.add(sourceKey(resource.item.source));
			}
		}),
	);
	return unavailable;
}

function fragmentMarkup(path: string, packaged: ReadonlyMap<string, ArrayBuffer>): string {
	const bytes = packaged.get(path);
	if (!bytes) throw new RuntimeFailure("fragment_missing");
	const markup = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	const template = document.createElement("template");
	template.innerHTML = markup;
	if (
		template.content.querySelector("script, style, link, base, meta, object, embed, iframe[srcdoc]")
	)
		throw new RuntimeFailure("fragment_script_forbidden");
	for (const element of template.content.querySelectorAll("*"))
		for (const attribute of element.attributes)
			if (
				attribute.name.toLowerCase().startsWith("on") ||
				(["href", "src", "action", "formaction"].includes(attribute.name.toLowerCase()) &&
					attribute.value.trim().toLowerCase().startsWith("javascript:"))
			)
				throw new RuntimeFailure("fragment_script_forbidden");
	return markup;
}

function insertFragments(
	theme: ResolvedCustomTheme,
	packaged: ReadonlyMap<string, ArrayBuffer>,
	roots: RuntimeRoots,
): void {
	for (const fragment of theme.manifest.fragments) {
		const target = fragment.slot === "header.append" ? roots.headerFragment : roots.footerFragment;
		target.insertAdjacentHTML("beforeend", fragmentMarkup(fragment.source.path, packaged));
	}
}

function packagedBlobUrl(
	path: string,
	theme: ResolvedCustomTheme,
	packaged: ReadonlyMap<string, ArrayBuffer>,
	blobUrls: string[],
): string {
	const file = theme.packagedFiles.find((candidate) => candidate.path === path);
	const bytes = packaged.get(path);
	if (!file || !bytes) throw new RuntimeFailure("packaged_file_missing");
	const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
	blobUrls.push(url);
	return url;
}

async function loadStyles(
	theme: ResolvedCustomTheme,
	packaged: ReadonlyMap<string, ArrayBuffer>,
	unavailable: ReadonlySet<string>,
	signal: AbortSignal,
	elements: HTMLElement[],
	blobUrls: string[],
): Promise<number> {
	let failureCount = 0;
	for (const style of theme.manifest.styles) {
		if (unavailable.has(sourceKey(style.source))) continue;
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.dataset.unitPresentationStyle = theme.revisionId;
		if (style.media) link.media = style.media;
		if (style.source.kind === "external") {
			link.href = style.source.url;
			applyAnonymousRequestPolicy(link, style.source, theme);
		} else {
			link.href = packagedBlobUrl(style.source.path, theme, packaged, blobUrls);
		}
		elements.push(link);
		document.head.append(link);
		try {
			await waitForElementLoad(link, signal);
		} catch (error) {
			link.remove();
			if (style.required) throw error;
			failureCount += 1;
		}
	}
	return failureCount;
}

async function loadClassicScript(
	theme: ResolvedCustomTheme,
	script: ManifestScript,
	packaged: ReadonlyMap<string, ArrayBuffer>,
	signal: AbortSignal,
	elements: HTMLElement[],
	blobUrls: string[],
): Promise<void> {
	const element = document.createElement("script");
	element.async = false;
	element.dataset.unitPresentationScript = theme.revisionId;
	if (script.source.kind === "external") {
		element.src = script.source.url;
		applyAnonymousRequestPolicy(element, script.source, theme);
	} else {
		element.src = packagedBlobUrl(script.source.path, theme, packaged, blobUrls);
	}
	elements.push(element);
	document.head.append(element);
	await waitForElementLoad(element, signal);
}

async function importModuleEntry(
	theme: ResolvedCustomTheme,
	entry: ManifestScript,
	packaged: ReadonlyMap<string, ArrayBuffer>,
	blobUrls: string[],
	importModule: (url: string) => Promise<unknown>,
): Promise<{ readonly mount: MountUnitPresentationV0 }> {
	const url =
		entry.source.kind === "external"
			? entry.source.url
			: packagedBlobUrl(entry.source.path, theme, packaged, blobUrls);
	const module = await importModule(url);
	if (
		typeof module !== "object" ||
		module === null ||
		!("mount" in module) ||
		typeof module.mount !== "function"
	)
		throw new RuntimeFailure("module_mount_missing");
	return { mount: module.mount as MountUnitPresentationV0 };
}

/**
 * Activates reviewed code with first-party privileges. This orchestrates
 * deterministic loading and cleanup; it is deliberately not an isolation
 * boundary.
 */
export function activateHostFullTrustCustomTheme(
	options: HostFullTrustRuntimeOptions,
	dependencies: HostFullTrustRuntimeDependencies = {},
): HostFullTrustRuntimeHandle {
	activeRuntime?.dispose();
	const token = Symbol(options.theme.revisionId);
	const controller = new AbortController();
	const elements: HTMLElement[] = [];
	const blobUrls: string[] = [];
	let mountDisposer: (() => void) | undefined;
	let disposed = false;
	let scriptExecutionStarted = false;
	const startedAt = performance.now();
	let longTaskObserver: PerformanceObserver | undefined;
	let observersInstalled = false;
	let cleanupFailureReported = false;

	const elapsedMilliseconds = () => {
		const elapsed = performance.now() - startedAt;
		return Number.isFinite(elapsed) ? Math.min(3_600_000, Math.max(0, elapsed)) : 0;
	};
	const emit = (
		phase: "runtime_error" | "unhandled_rejection" | "long_task" | "cleanup_failure" | "disposed",
		detail: { readonly reason?: string; readonly durationMilliseconds?: number } = {},
	) =>
		emitUnitPresentationRuntimeEvent({
			contract: "rezics.unit.presentation@0",
			executionMode: "host_full_trust",
			hostUnitId: options.hostUnit.id,
			phase,
			revisionId: options.theme.revisionId,
			...detail,
		});
	const handleWindowError = () => emit("runtime_error", { reason: "window_error" });
	const handleUnhandledRejection = () =>
		emit("unhandled_rejection", { reason: "unhandled_rejection" });
	const removeRuntimeObservers = () => {
		if (!observersInstalled) return;
		observersInstalled = false;
		window.removeEventListener("error", handleWindowError);
		window.removeEventListener("unhandledrejection", handleUnhandledRejection);
		longTaskObserver?.disconnect();
		longTaskObserver = undefined;
	};
	const installRuntimeObservers = () => {
		if (observersInstalled) return;
		observersInstalled = true;
		window.addEventListener("error", handleWindowError);
		window.addEventListener("unhandledrejection", handleUnhandledRejection);
		try {
			longTaskObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries())
					emit("long_task", {
						durationMilliseconds: Math.min(3_600_000, Math.max(0, entry.duration)),
					});
			});
			longTaskObserver.observe({ type: "longtask", buffered: true });
		} catch {
			longTaskObserver = undefined;
		}
	};
	const removeArtifacts = (): boolean => {
		let passed = true;
		for (const element of elements)
			try {
				element.remove();
			} catch {
				passed = false;
			}
		elements.length = 0;
		for (const url of blobUrls)
			try {
				URL.revokeObjectURL(url);
			} catch {
				passed = false;
			}
		blobUrls.length = 0;
		for (const root of [options.roots.headerFragment, options.roots.footerFragment])
			try {
				root.replaceChildren();
			} catch {
				passed = false;
			}
		return passed;
	};
	const cleanupRuntime = () => {
		removeRuntimeObservers();
		let passed = true;
		const disposer = mountDisposer;
		mountDisposer = undefined;
		try {
			disposer?.();
		} catch {
			passed = false;
		}
		passed = removeArtifacts() && passed;
		if (!passed && !cleanupFailureReported) {
			cleanupFailureReported = true;
			emit("cleanup_failure", {
				durationMilliseconds: elapsedMilliseconds(),
				reason: "cleanup_failed",
			});
		}
	};
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		controller.abort();
		cleanupRuntime();
		if (activeRuntime?.token === token) activeRuntime = undefined;
		emit("disposed", { durationMilliseconds: elapsedMilliseconds() });
	};
	activeRuntime = { token, dispose };

	emitUnitPresentationRuntimeEvent({
		contract: "rezics.unit.presentation@0",
		executionMode: "host_full_trust",
		hostUnitId: options.hostUnit.id,
		phase: "loading",
		revisionId: options.theme.revisionId,
	});

	void (async () => {
		try {
			const [packagedResult, externalUnavailable] = await Promise.all([
				fetchPackagedResources(options.theme, controller.signal),
				preflightExternalResources(options.theme, controller.signal, elements),
			]);
			const packaged = packagedResult.values;
			const unavailable = new Set([...packagedResult.unavailable, ...externalUnavailable]);
			let resourceFailureCount = unavailable.size;
			if (disposed) return;
			insertFragments(options.theme, packaged, options.roots);
			resourceFailureCount += await loadStyles(
				options.theme,
				packaged,
				unavailable,
				controller.signal,
				elements,
				blobUrls,
			);
			const classicScripts = options.theme.manifest.scripts
				.filter((script) => script.role === "classic_dependency")
				.sort((left, right) => left.order - right.order);
			for (const script of classicScripts) {
				if (unavailable.has(sourceKey(script.source))) continue;
				scriptExecutionStarted = true;
				try {
					await loadClassicScript(
						options.theme,
						script,
						packaged,
						controller.signal,
						elements,
						blobUrls,
					);
				} catch (error) {
					if (script.required) throw error;
					resourceFailureCount += 1;
				}
			}
			const entry = options.theme.manifest.scripts.find((script) => script.role === "module_entry");
			if (!entry || unavailable.has(sourceKey(entry.source)))
				throw new RuntimeFailure("module_entry_unavailable");
			scriptExecutionStarted = true;
			const module = await importModuleEntry(
				options.theme,
				entry,
				packaged,
				blobUrls,
				dependencies.importModule ?? ((url) => import(/* @vite-ignore */ url)),
			);
			const context: UnitPresentationContextV0 = {
				hostUnit: options.hostUnit,
				targetContract: "rezics.unit.presentation@0",
				headerRoot: options.roots.header,
				mainRoot: options.roots.main,
				footerRoot: options.roots.footer,
				signal: controller.signal,
			};
			mountDisposer = (await module.mount(context)) ?? undefined;
			if (disposed) {
				cleanupRuntime();
				return;
			}
			installRuntimeObservers();
			options.onActive();
			emitUnitPresentationRuntimeEvent({
				contract: "rezics.unit.presentation@0",
				executionMode: "host_full_trust",
				hostUnitId: options.hostUnit.id,
				phase: "resource_summary",
				revisionId: options.theme.revisionId,
				resourceCount:
					options.theme.manifest.fragments.length +
					options.theme.manifest.styles.length +
					options.theme.manifest.scripts.length,
				failureCount: resourceFailureCount,
				durationMilliseconds: elapsedMilliseconds(),
			});
			emitUnitPresentationRuntimeEvent({
				contract: "rezics.unit.presentation@0",
				executionMode: "host_full_trust",
				hostUnitId: options.hostUnit.id,
				phase: "active",
				revisionId: options.theme.revisionId,
				durationMilliseconds: elapsedMilliseconds(),
			});
		} catch (error) {
			if (disposed || controller.signal.aborted) return;
			const phase = scriptExecutionStarted ? "post_execution_failure" : "pre_execution_failure";
			controller.abort();
			cleanupRuntime();
			emitUnitPresentationRuntimeEvent({
				contract: "rezics.unit.presentation@0",
				executionMode: "host_full_trust",
				hostUnitId: options.hostUnit.id,
				phase,
				reason: error instanceof RuntimeFailure ? error.code : "unexpected_failure",
				revisionId: options.theme.revisionId,
				durationMilliseconds: elapsedMilliseconds(),
			});
			if (scriptExecutionStarted) options.onPostExecutionFailure();
			else options.onPreExecutionFailure();
		}
	})();

	return { dispose };
}
