/** @vitest-environment jsdom */

import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResolvedCustomTheme } from "./resolved-presentation";
import {
	activateHostFullTrustCustomTheme,
	type HostFullTrustRuntimeHandle,
} from "./host-full-trust-runtime";
import {
	UnitPresentationRuntimeEventName,
	type UnitPresentationRuntimeEventDetail,
} from "./lifecycle";

const HostUnitId = "019f9000-0000-7000-8000-000000000001";
const RevisionId = "019f9000-0000-7000-8000-000000000002";
let currentRuntime: HostFullTrustRuntimeHandle | undefined;

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function packagedFile(path: string, role: "html" | "css" | "js", content: string) {
	return {
		path,
		role,
		contentType: role === "html" ? "text/html" : role === "css" ? "text/css" : "text/javascript",
		sha256: sha256(content),
		contentUrl: `/theme-file/${path}`,
	};
}

function theme(): {
	readonly value: ResolvedCustomTheme;
	readonly content: ReadonlyMap<string, string>;
} {
	const content = new Map([
		["header.html", '<p data-theme-fragment="header">Header fragment</p>'],
		["theme.css", ":root { --theme-ready: 1; }"],
		["dependency.js", "globalThis.__themeDependency = true;"],
		["entry.js", "export function mount() {}"],
	]);
	return {
		content,
		value: {
			revisionId: RevisionId,
			customThemeUnitId: "019f9000-0000-7000-8000-000000000003",
			executionMode: "host_full_trust",
			resourceMode: "external_live",
			executionAudience: "capability_gated_preview",
			approvalScope: { kind: "host_unit", hostUnitId: HostUnitId },
			manifest: {
				schemaVersion: 0,
				targetContract: "rezics.unit.presentation@0",
				executionMode: "host_full_trust",
				resourceMode: "external_live",
				fragments: [{ slot: "header.append", source: { kind: "packaged", path: "header.html" } }],
				styles: [{ source: { kind: "packaged", path: "theme.css" }, required: true }],
				scripts: [
					{
						source: { kind: "packaged", path: "dependency.js" },
						role: "classic_dependency",
						order: 0,
						required: true,
					},
					{
						source: { kind: "packaged", path: "entry.js" },
						role: "module_entry",
						order: 1,
						required: true,
					},
				],
				declaredRuntimeOrigins: { connect: [], image: [], font: [], frame: [], media: [] },
			},
			externalResources: [],
			packagedFiles: [...content].map(([path, value]) =>
				packagedFile(
					path,
					path.endsWith(".html") ? "html" : path.endsWith(".css") ? "css" : "js",
					value,
				),
			),
		},
	};
}

function roots() {
	const header = document.createElement("header");
	const headerFragment = document.createElement("div");
	header.append(headerFragment);
	const main = document.createElement("main");
	const footer = document.createElement("footer");
	const footerFragment = document.createElement("div");
	footer.append(footerFragment);
	document.body.append(header, main, footer);
	return { header, headerFragment, main, footer, footerFragment };
}

function installBrowserFakes(content: ReadonlyMap<string, string>, autoLoad = true) {
	let blobSequence = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		value: vi.fn(() => `blob:https://www.example.test/${++blobSequence}`),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const path = new URL(String(input), window.location.href).pathname.split("/").at(-1) ?? "";
			const value = content.get(path);
			return value === undefined ? new Response(null, { status: 404 }) : new Response(value);
		}),
	);
	const append = document.head.append.bind(document.head);
	vi.spyOn(document.head, "append").mockImplementation((...nodes: (Node | string)[]) => {
		append(...nodes);
		if (autoLoad)
			for (const node of nodes)
				if (node instanceof HTMLElement)
					queueMicrotask(() => node.dispatchEvent(new Event("load")));
	});
}

afterEach(() => {
	currentRuntime?.dispose();
	currentRuntime = undefined;
	document.head.replaceChildren();
	document.body.replaceChildren();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("host_full_trust Custom Theme runtime", () => {
	it("loads fragments, styles, classic scripts, then mounts one module and disposes it", async () => {
		const fixture = theme();
		installBrowserFakes(fixture.content);
		const runtimeRoots = roots();
		const disposer = vi.fn();
		const mount = vi.fn(() => disposer);
		const onActive = vi.fn();
		currentRuntime = activateHostFullTrustCustomTheme(
			{
				hostUnit: { id: HostUnitId, kind: "zone" },
				roots: runtimeRoots,
				theme: fixture.value,
				onActive,
				onPreExecutionFailure: vi.fn(),
				onPostExecutionFailure: vi.fn(),
			},
			{ importModule: vi.fn(async () => ({ mount })) },
		);

		await vi.waitFor(() => expect(onActive).toHaveBeenCalledOnce());
		expect(runtimeRoots.headerFragment.textContent).toContain("Header fragment");
		expect(mount).toHaveBeenCalledWith(
			expect.objectContaining({
				hostUnit: { id: HostUnitId, kind: "zone" },
				headerRoot: runtimeRoots.header,
				mainRoot: runtimeRoots.main,
				footerRoot: runtimeRoots.footer,
			}),
		);
		const loaded = [...document.head.children].filter(
			(element) =>
				element.hasAttribute("data-unit-presentation-style") ||
				element.hasAttribute("data-unit-presentation-script"),
		);
		expect(loaded.map((element) => element.tagName)).toEqual(["LINK", "SCRIPT"]);

		currentRuntime.dispose();
		expect(disposer).toHaveBeenCalledOnce();
		expect(runtimeRoots.headerFragment.childElementCount).toBe(0);
		expect(document.head.querySelector("[data-unit-presentation-style]")).toBeNull();
	});

	it("fails closed before executing scripts when a required packaged resource is unavailable", async () => {
		const fixture = theme();
		installBrowserFakes(new Map());
		const onPreExecutionFailure = vi.fn();
		const onPostExecutionFailure = vi.fn();
		const importModule = vi.fn(async () => ({ mount: vi.fn() }));
		currentRuntime = activateHostFullTrustCustomTheme(
			{
				hostUnit: { id: HostUnitId, kind: "zone" },
				roots: roots(),
				theme: fixture.value,
				onActive: vi.fn(),
				onPreExecutionFailure,
				onPostExecutionFailure,
			},
			{ importModule },
		);

		await vi.waitFor(() => expect(onPreExecutionFailure).toHaveBeenCalledOnce());
		expect(importModule).not.toHaveBeenCalled();
		expect(onPostExecutionFailure).not.toHaveBeenCalled();
		expect(document.head.querySelector("[data-unit-presentation-script]")).toBeNull();
	});

	it("continues when an optional packaged resource is unavailable", async () => {
		const fixture = theme();
		const content = new Map(fixture.content);
		content.delete("theme.css");
		installBrowserFakes(content);
		const onActive = vi.fn();
		const importModule = vi.fn(async () => ({ mount: vi.fn() }));
		currentRuntime = activateHostFullTrustCustomTheme(
			{
				hostUnit: { id: HostUnitId, kind: "zone" },
				roots: roots(),
				theme: {
					...fixture.value,
					manifest: {
						...fixture.value.manifest,
						styles: fixture.value.manifest.styles.map((style) => ({
							...style,
							required: false,
						})),
					},
				},
				onActive,
				onPreExecutionFailure: vi.fn(),
				onPostExecutionFailure: vi.fn(),
			},
			{ importModule },
		);

		await vi.waitFor(() => expect(onActive).toHaveBeenCalledOnce());
		expect(importModule).toHaveBeenCalledOnce();
		expect(document.head.querySelector("[data-unit-presentation-style]")).toBeNull();
	});

	it("uses post-execution recovery when module mounting rejects", async () => {
		const fixture = theme();
		installBrowserFakes(fixture.content);
		const runtimeRoots = roots();
		const onPreExecutionFailure = vi.fn();
		const onPostExecutionFailure = vi.fn();
		currentRuntime = activateHostFullTrustCustomTheme(
			{
				hostUnit: { id: HostUnitId, kind: "zone" },
				roots: runtimeRoots,
				theme: fixture.value,
				onActive: vi.fn(),
				onPreExecutionFailure,
				onPostExecutionFailure,
			},
			{
				importModule: vi.fn(async () => ({
					mount: vi.fn(async () => {
						throw new Error("mount rejected");
					}),
				})),
			},
		);

		await vi.waitFor(() => expect(onPostExecutionFailure).toHaveBeenCalledOnce());
		expect(onPreExecutionFailure).not.toHaveBeenCalled();
		expect(runtimeRoots.headerFragment.childElementCount).toBe(0);
		expect(document.head.querySelector("[data-unit-presentation-script]")).toBeNull();
	});

	it("aborts the lifecycle and invokes a late async disposer on route leave", async () => {
		const fixture = theme();
		installBrowserFakes(fixture.content);
		let resolveMount: ((disposer: () => void) => void) | undefined;
		const disposer = vi.fn();
		let observedSignal: AbortSignal | undefined;
		const mount = vi.fn((context: { signal: AbortSignal }) => {
			observedSignal = context.signal;
			return new Promise<() => void>((resolve) => {
				resolveMount = resolve;
			});
		});
		currentRuntime = activateHostFullTrustCustomTheme(
			{
				hostUnit: { id: HostUnitId, kind: "zone" },
				roots: roots(),
				theme: fixture.value,
				onActive: vi.fn(),
				onPreExecutionFailure: vi.fn(),
				onPostExecutionFailure: vi.fn(),
			},
			{ importModule: vi.fn(async () => ({ mount })) },
		);
		await vi.waitFor(() => expect(mount).toHaveBeenCalledOnce());

		currentRuntime.dispose();
		expect(observedSignal?.aborted).toBe(true);
		resolveMount?.(disposer);
		await vi.waitFor(() => expect(disposer).toHaveBeenCalledOnce());
	});

	it("disposes the previous runtime before activating another revision", async () => {
		const first = theme();
		installBrowserFakes(first.content);
		const firstDisposer = vi.fn();
		const firstActive = vi.fn();
		currentRuntime = activateHostFullTrustCustomTheme(
			{
				hostUnit: { id: HostUnitId, kind: "zone" },
				roots: roots(),
				theme: first.value,
				onActive: firstActive,
				onPreExecutionFailure: vi.fn(),
				onPostExecutionFailure: vi.fn(),
			},
			{ importModule: vi.fn(async () => ({ mount: () => firstDisposer })) },
		);
		await vi.waitFor(() => expect(firstActive).toHaveBeenCalledOnce());

		const second = theme();
		const secondActive = vi.fn();
		currentRuntime = activateHostFullTrustCustomTheme(
			{
				hostUnit: { id: HostUnitId, kind: "zone" },
				roots: roots(),
				theme: { ...second.value, revisionId: "019f9000-0000-7000-8000-000000000004" },
				onActive: secondActive,
				onPreExecutionFailure: vi.fn(),
				onPostExecutionFailure: vi.fn(),
			},
			{ importModule: vi.fn(async () => ({ mount: vi.fn() })) },
		);
		await vi.waitFor(() => expect(secondActive).toHaveBeenCalledOnce());
		expect(firstDisposer).toHaveBeenCalledOnce();
	});

	it("contains disposer failures and records bounded cleanup telemetry", async () => {
		const fixture = theme();
		installBrowserFakes(fixture.content);
		const phases: string[] = [];
		const listener = (event: Event) =>
			phases.push((event as CustomEvent<UnitPresentationRuntimeEventDetail>).detail.phase);
		window.addEventListener(UnitPresentationRuntimeEventName, listener);
		try {
			const onActive = vi.fn();
			currentRuntime = activateHostFullTrustCustomTheme(
				{
					hostUnit: { id: HostUnitId, kind: "zone" },
					roots: roots(),
					theme: fixture.value,
					onActive,
					onPreExecutionFailure: vi.fn(),
					onPostExecutionFailure: vi.fn(),
				},
				{
					importModule: vi.fn(async () => ({
						mount: () => () => {
							throw new Error("cleanup failed");
						},
					})),
				},
			);
			await vi.waitFor(() => expect(onActive).toHaveBeenCalledOnce());
			expect(() => currentRuntime?.dispose()).not.toThrow();
			expect(phases).toContain("cleanup_failure");
			expect(phases).toContain("disposed");
		} finally {
			window.removeEventListener(UnitPresentationRuntimeEventName, listener);
		}
	});

	it("times out a required external resource before any theme script executes", async () => {
		vi.useFakeTimers();
		const fixture = theme();
		installBrowserFakes(fixture.content, false);
		const externalTheme: ResolvedCustomTheme = {
			...fixture.value,
			manifest: {
				...fixture.value.manifest,
				styles: [
					{
						source: {
							kind: "external",
							url: "https://styles.example/theme.css",
							integrityWaiverReason: "Mutable reviewed preview resource",
						},
						required: true,
					},
				],
			},
		};
		const onPreExecutionFailure = vi.fn();
		const importModule = vi.fn(async () => ({ mount: vi.fn() }));
		currentRuntime = activateHostFullTrustCustomTheme(
			{
				hostUnit: { id: HostUnitId, kind: "zone" },
				roots: roots(),
				theme: externalTheme,
				onActive: vi.fn(),
				onPreExecutionFailure,
				onPostExecutionFailure: vi.fn(),
			},
			{ importModule },
		);
		await vi.advanceTimersByTimeAsync(10_001);
		await vi.waitFor(() => expect(onPreExecutionFailure).toHaveBeenCalledOnce());
		expect(importModule).not.toHaveBeenCalled();
	});
});
