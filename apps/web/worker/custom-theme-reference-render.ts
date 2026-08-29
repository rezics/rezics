import {
	CustomThemeReferenceRenderRequestV0,
	MaximumCustomThemeResourceLoadMilliseconds,
	isDocument,
	type CustomThemeReferenceRenderRequestV0 as ReferenceRenderRequest,
	type CustomThemeReferenceRenderResultV0 as ReferenceRenderResult,
} from "@rezics/block";
import type { BrowserWorker, Page, Request as PlaywrightRequest } from "@cloudflare/playwright";

export const CustomThemeReferenceRenderPath = "/__internal/custom-theme-reference-render";
const RendererVersion = "rezics-cloudflare-playwright/1.3.0";
const MaximumRequestBytes = 4 * 1_024 * 1_024;
const MaximumRenderMilliseconds = 45_000;

interface ReferenceRendererEnvironment {
	readonly BROWSER: BrowserWorker;
	readonly CUSTOM_THEME_REFERENCE_RENDER_TOKEN: string;
}

interface FixtureDefinition {
	readonly colorScheme: "light" | "dark";
	readonly height: number;
	readonly label: string;
	readonly width: number;
}

const ReferenceFixtures: readonly FixtureDefinition[] = [
	{ colorScheme: "light", height: 900, label: "desktop-1440x900", width: 1_440 },
	{ colorScheme: "dark", height: 844, label: "mobile-390x844", width: 390 },
];

interface ReferenceMeasurements {
	readonly interactionToNextPaintMilliseconds: number;
	readonly largestContentfulPaintMilliseconds: number;
	readonly layoutShift: number;
	readonly longTaskMilliseconds: number;
	readonly memoryBytes: number;
	readonly transferredBytes: number;
}

const ReferenceMetricsInitScript = `(() => {
	const metrics = {
		interactionToNextPaintMilliseconds: 0,
		largestContentfulPaintMilliseconds: 0,
		layoutShift: 0,
		longTaskMilliseconds: 0,
	};
	Object.defineProperty(window, "__rezicsReferenceMetrics", {
		configurable: false,
		value: metrics,
		writable: false,
	});
	try {
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries())
				metrics.largestContentfulPaintMilliseconds = Math.max(
					metrics.largestContentfulPaintMilliseconds,
					entry.startTime,
				);
		}).observe({ type: "largest-contentful-paint", buffered: true });
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries())
				if (!entry.hadRecentInput) metrics.layoutShift += entry.value ?? 0;
		}).observe({ type: "layout-shift", buffered: true });
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) metrics.longTaskMilliseconds += entry.duration;
		}).observe({ type: "longtask", buffered: true });
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries())
				metrics.interactionToNextPaintMilliseconds = Math.max(
					metrics.interactionToNextPaintMilliseconds,
					entry.duration,
				);
		}).observe({ type: "event", buffered: true, durationThreshold: 16 });
	} catch {
		// Unsupported observers remain explicit zero-valued measurements.
	}
})();`;

const ReferenceMeasurementsExpression = `() => {
	const metrics = window.__rezicsReferenceMetrics;
	return {
		interactionToNextPaintMilliseconds: metrics?.interactionToNextPaintMilliseconds ?? 0,
		largestContentfulPaintMilliseconds: metrics?.largestContentfulPaintMilliseconds ?? 0,
		layoutShift: metrics?.layoutShift ?? 0,
		longTaskMilliseconds: metrics?.longTaskMilliseconds ?? 0,
		memoryBytes: Math.max(0, Math.round(performance.memory?.usedJSHeapSize ?? 0)),
		transferredBytes: Math.max(
			0,
			Math.round(
				performance
					.getEntriesByType("resource")
					.reduce((total, entry) => total + (entry.transferSize || 0), 0),
			),
		),
	};
}`;

const ReferenceAccessibilityExpression = `() => {
	const values = [];
	if (document.querySelectorAll("img:not([alt])").length)
		values.push("Rendered fixture contains images without alt text.");
	if (document.querySelectorAll("input:not([aria-label]):not([aria-labelledby])").length)
		values.push("Rendered fixture contains inputs without an explicit accessible label.");
	if (document.documentElement.scrollWidth > document.documentElement.clientWidth)
		values.push("Rendered fixture overflows the horizontal viewport.");
	return values;
}`;

const ReferenceCleanupExpression = `async () => {
	const runtime = window.__rezicsReferenceRuntime;
	try {
		await runtime?.disposer?.();
	} catch {
		return false;
	} finally {
		runtime?.controller?.abort();
		document.querySelectorAll("[data-rezics-review-artifact]").forEach((node) => node.remove());
		for (const selector of [
			"[data-rezics-review-header]",
			"[data-rezics-review-main]",
			"[data-rezics-review-footer]",
		]) document.querySelector(selector)?.replaceChildren();
	}
	return (
		document.querySelectorAll("[data-rezics-review-artifact]").length === 0 &&
		["header", "main", "footer"].every(
			(tag) => document.querySelector("[data-rezics-review-" + tag + "]")?.childNodes.length === 0,
		)
	);
}`;

type RuntimeOriginKind = keyof ReferenceRenderResult["observedRuntimeOrigins"];

function escapeAttribute(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function scriptLiteral(value: string): string {
	return JSON.stringify(value)
		.replaceAll("<", "\\u003c")
		.replaceAll("\u2028", "\\u2028")
		.replaceAll("\u2029", "\\u2029");
}

function sha256Integrity(hex: string): string {
	let binary = "";
	for (let index = 0; index < hex.length; index += 2)
		binary += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16));
	return `sha256-${btoa(binary)}`;
}

function sourceAttributes(
	request: ReferenceRenderRequest,
	source: ReferenceRenderRequest["manifest"]["styles"][number]["source"],
): { readonly integrity: string; readonly url: string } {
	if (source.kind === "external") return { integrity: source.integrity ?? "", url: source.url };
	const packaged = request.packagedResources.find(({ path }) => path === source.path);
	if (!packaged) throw new Error(`Missing packaged reference-render resource: ${source.path}`);
	return { integrity: sha256Integrity(packaged.sha256), url: packaged.url };
}

/** Builds the isolated fixture document; resource access is still enforced by Playwright routing. */
export function buildCustomThemeReferenceRenderDocument(request: ReferenceRenderRequest): string {
	const styles = request.manifest.styles
		.map((style) => {
			const source = sourceAttributes(request, style.source);
			return `<link data-rezics-review-artifact="style" rel="stylesheet" href="${escapeAttribute(source.url)}"${source.integrity ? ` integrity="${escapeAttribute(source.integrity)}" crossorigin="anonymous"` : ""}${style.media ? ` media="${escapeAttribute(style.media)}"` : ""} referrerpolicy="no-referrer">`;
		})
		.join("");
	const classicScripts = request.manifest.scripts
		.filter(({ role }) => role === "classic_dependency")
		.sort((left, right) => left.order - right.order)
		.map((script) => {
			const source = sourceAttributes(request, script.source);
			return `<script data-rezics-review-artifact="script" src="${escapeAttribute(source.url)}"${source.integrity ? ` integrity="${escapeAttribute(source.integrity)}" crossorigin="anonymous"` : ""} referrerpolicy="no-referrer"><\/script>`;
		})
		.join("");
	const entry = request.manifest.scripts.find(({ role }) => role === "module_entry");
	if (!entry) throw new Error("Reference render requires one module entrypoint");
	const entrySource = sourceAttributes(request, entry.source);
	const preload = `<link data-rezics-review-artifact="modulepreload" rel="modulepreload" href="${escapeAttribute(entrySource.url)}"${entrySource.integrity ? ` integrity="${escapeAttribute(entrySource.integrity)}"` : ""} crossorigin="anonymous" referrerpolicy="no-referrer">`;
	const moduleHarness = `<script data-rezics-review-artifact="module" type="module">
		(async () => {
			try {
				const controller = new AbortController();
				const module = await import(${scriptLiteral(entrySource.url)});
				if (typeof module.mount !== "function") throw new Error("module_mount_missing");
				const disposer = await module.mount({
					hostUnit: { id: ${scriptLiteral(request.revisionId)}, kind: "zone" },
					targetContract: "rezics.unit.presentation@0",
					headerRoot: document.querySelector("[data-rezics-review-header]"),
					mainRoot: document.querySelector("[data-rezics-review-main]"),
					footerRoot: document.querySelector("[data-rezics-review-footer]"),
					signal: controller.signal,
				});
				window.__rezicsReferenceRuntime = { controller, disposer };
				document.documentElement.dataset.rezicsReviewState = "active";
			} catch (error) {
				console.error("Custom Theme reference mount failed", error);
				document.documentElement.dataset.rezicsReviewState = "failed";
			}
		})();
	<\/script>`;
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width,initial-scale=1">
		<title>REZICS Custom Theme reference fixture</title>
		<style>html{color-scheme:light dark}body{margin:0;min-height:100vh;font:16px/1.5 system-ui,sans-serif}header,main,footer{padding:1rem}main{min-height:60vh}.rezics-reference-card{max-width:48rem;margin:2rem auto;padding:1.5rem;border:1px solid currentColor;border-radius:.75rem}</style>
		${styles}${preload}${classicScripts}
	</head>
	<body>
		<header data-rezics-review-header>${request.headerMarkup}</header>
		<main data-rezics-review-main><article class="rezics-reference-card"><h1>Reference fixture</h1><p>Typography, spacing, links, controls, and responsive behavior are exercised here.</p><p><a href="#fixture-target">Fixture link</a></p><button type="button">Fixture action</button><div id="fixture-target" tabindex="-1">Fixture target</div></article></main>
		<footer data-rezics-review-footer>${request.footerMarkup}</footer>
		${moduleHarness}
	</body>
</html>`;
}

function runtimeOriginKind(request: PlaywrightRequest, page: Page): RuntimeOriginKind | undefined {
	const resourceType = request.resourceType();
	if (["xhr", "fetch", "websocket", "eventsource"].includes(resourceType)) return "connect";
	if (resourceType === "image") return "image";
	if (resourceType === "font") return "font";
	if (resourceType === "media") return "media";
	if (resourceType === "document" && request.isNavigationRequest()) {
		try {
			if (request.frame() !== page.mainFrame()) return "frame";
		} catch {
			return undefined;
		}
	}
	return undefined;
}

async function secureTokenEquals(expected: string, supplied: string): Promise<boolean> {
	const encoder = new TextEncoder();
	const [expectedDigest, suppliedDigest] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(expected)),
		crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
	]);
	const left = new Uint8Array(expectedDigest);
	const right = new Uint8Array(suppliedDigest);
	let difference = left.length ^ right.length;
	for (let index = 0; index < Math.max(left.length, right.length); index += 1)
		difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
	return difference === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let index = 0; index < bytes.length; index += 16_384)
		binary += String.fromCharCode(...bytes.subarray(index, index + 16_384));
	return btoa(binary);
}

async function renderReferenceFixtures(
	input: ReferenceRenderRequest,
	environment: ReferenceRendererEnvironment,
): Promise<ReferenceRenderResult> {
	const { launch } = await import("@cloudflare/playwright");
	const browser = await launch(environment.BROWSER);
	const absoluteTimeout = setTimeout(() => void browser.close(), MaximumRenderMilliseconds);
	const observedRuntimeOrigins: Record<RuntimeOriginKind, Set<string>> = {
		connect: new Set(),
		image: new Set(),
		font: new Set(),
		frame: new Set(),
		media: new Set(),
	};
	const fixtures: ReferenceRenderResult["fixtures"] = [];
	const accessibilityFindings = new Set<string>();
	let cleanupPassed = true;
	try {
		for (const fixture of ReferenceFixtures) {
			const context = await browser.newContext({
				colorScheme: fixture.colorScheme,
				serviceWorkers: "block",
				viewport: { height: fixture.height, width: fixture.width },
			});
			const page = await context.newPage();
			page.setDefaultTimeout(MaximumCustomThemeResourceLoadMilliseconds);
			page.setDefaultNavigationTimeout(MaximumCustomThemeResourceLoadMilliseconds);
			let consoleErrorCount = 0;
			let loadFailureCount = 0;
			let requestCount = 0;
			const allowedOrigins = new Set(input.allowedOrigins);
			const packagedByUrl = new Map(
				input.packagedResources.map((resource) => [resource.url, resource]),
			);
			page.on("console", (message) => {
				if (message.type() === "error") consoleErrorCount += 1;
			});
			page.on("pageerror", () => {
				consoleErrorCount += 1;
			});
			page.on("requestfailed", () => {
				loadFailureCount += 1;
			});
			page.on("request", (browserRequest) => {
				let url: URL;
				try {
					url = new URL(browserRequest.url());
				} catch {
					return;
				}
				if (url.protocol !== "https:") return;
				requestCount += 1;
				const kind = runtimeOriginKind(browserRequest, page);
				if (kind) observedRuntimeOrigins[kind].add(url.origin);
			});
			await page.route("**/*", async (route) => {
				let url: URL;
				try {
					url = new URL(route.request().url());
				} catch {
					await route.abort("blockedbyclient");
					return;
				}
				if (["about:", "blob:", "data:"].includes(url.protocol)) {
					await route.continue();
					return;
				}
				const packaged = packagedByUrl.get(url.href);
				if (packaged) {
					const response = await route.fetch({
						timeout: MaximumCustomThemeResourceLoadMilliseconds,
					});
					await route.fulfill({
						response,
						headers: {
							...response.headers(),
							"access-control-allow-origin": "*",
							"content-type": packaged.contentType,
							"x-content-type-options": "nosniff",
						},
					});
					return;
				}
				if (url.protocol === "https:" && allowedOrigins.has(url.origin)) {
					await route.continue();
					return;
				}
				loadFailureCount += 1;
				await route.abort("blockedbyclient");
			});
			await page.addInitScript({ content: ReferenceMetricsInitScript });
			try {
				await page.setContent(buildCustomThemeReferenceRenderDocument(input), {
					timeout: MaximumCustomThemeResourceLoadMilliseconds,
					waitUntil: "load",
				});
				await page.waitForFunction(
					`() => ["active", "failed"].includes(document.documentElement.dataset.rezicsReviewState ?? "")`,
					undefined,
					{ timeout: MaximumCustomThemeResourceLoadMilliseconds },
				);
			} catch {
				loadFailureCount += 1;
			}
			await page
				.locator("[data-rezics-review-main] button")
				.first()
				.click({ timeout: 1_000 })
				.catch(() => undefined);
			await page.waitForTimeout(250);
			const measurements = await page.evaluate<ReferenceMeasurements>(
				ReferenceMeasurementsExpression,
			);
			const findings = await page.evaluate<readonly string[]>(ReferenceAccessibilityExpression);
			for (const finding of findings) accessibilityFindings.add(finding);
			const screenshot = await page.screenshot({
				fullPage: false,
				timeout: MaximumCustomThemeResourceLoadMilliseconds,
				type: "png",
			});
			fixtures.push({
				viewport: fixture.label,
				colorScheme: fixture.colorScheme,
				screenshotBase64: bytesToBase64(screenshot),
				consoleErrorCount,
				loadFailureCount,
				layoutShift: Math.max(0, measurements.layoutShift),
				largestContentfulPaintMilliseconds: Math.max(
					0,
					measurements.largestContentfulPaintMilliseconds,
				),
				interactionToNextPaintMilliseconds: Math.max(
					0,
					measurements.interactionToNextPaintMilliseconds,
				),
				longTaskMilliseconds: Math.max(0, measurements.longTaskMilliseconds),
				memoryBytes: measurements.memoryBytes,
				transferredBytes: measurements.transferredBytes,
				requestCount,
			});
			const fixtureCleanupPassed = await page.evaluate<boolean>(ReferenceCleanupExpression);
			cleanupPassed &&= fixtureCleanupPassed;
			await context.close();
		}
	} finally {
		clearTimeout(absoluteTimeout);
		await browser.close().catch(() => undefined);
	}
	return {
		rendererVersion: RendererVersion,
		observedRuntimeOrigins: {
			connect: [...observedRuntimeOrigins.connect].sort(),
			image: [...observedRuntimeOrigins.image].sort(),
			font: [...observedRuntimeOrigins.font].sort(),
			frame: [...observedRuntimeOrigins.frame].sort(),
			media: [...observedRuntimeOrigins.media].sort(),
		},
		fixtures,
		accessibilityFindings: [...accessibilityFindings].sort(),
		cleanupPassed,
	};
}

export function isCustomThemeReferenceRenderRequest(request: Request): boolean {
	return (
		request.method === "POST" && new URL(request.url).pathname === CustomThemeReferenceRenderPath
	);
}

export async function handleCustomThemeReferenceRenderRequest(
	request: Request,
	environment: ReferenceRendererEnvironment,
	render: (
		input: ReferenceRenderRequest,
		environment: ReferenceRendererEnvironment,
	) => Promise<ReferenceRenderResult> = renderReferenceFixtures,
): Promise<Response> {
	const authorization = request.headers.get("authorization") ?? "";
	const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
	if (
		!environment.CUSTOM_THEME_REFERENCE_RENDER_TOKEN ||
		!(await secureTokenEquals(environment.CUSTOM_THEME_REFERENCE_RENDER_TOKEN, suppliedToken))
	)
		return new Response("Not Found", { status: 404 });
	const declaredLength = Number(request.headers.get("content-length") ?? 0);
	if (Number.isFinite(declaredLength) && declaredLength > MaximumRequestBytes)
		return Response.json({ error: "request_too_large" }, { status: 413 });
	let body: unknown;
	try {
		const text = await request.text();
		if (new TextEncoder().encode(text).byteLength > MaximumRequestBytes)
			return Response.json({ error: "request_too_large" }, { status: 413 });
		body = JSON.parse(text);
	} catch {
		return Response.json({ error: "request_invalid" }, { status: 400 });
	}
	if (!isDocument(CustomThemeReferenceRenderRequestV0, body))
		return Response.json({ error: "request_invalid" }, { status: 400 });
	try {
		return Response.json(await render(body, environment), {
			headers: { "cache-control": "private, no-store" },
		});
	} catch (error) {
		console.error(
			JSON.stringify({
				event: "custom_theme_reference_render_failed",
				message: error instanceof Error ? error.message : "unknown error",
				revisionId: body.revisionId,
			}),
		);
		return Response.json({ error: "render_failed" }, { status: 502 });
	}
}
