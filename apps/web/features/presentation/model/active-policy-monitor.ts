const UuidPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const MaximumProbeResponseBytes = 512;

export const ActivePresentationPolicyProbeIntervalMilliseconds = 60_000;
export const ActivePresentationPolicyProbePath = "/__rezics/presentation-policy";

export type ActivePresentationPolicyNavigation = "continue" | "reload" | "safe_mode";

export function activePresentationPolicyNavigation(
	currentRevisionId: string,
	nextRevisionId: string | null,
): ActivePresentationPolicyNavigation {
	if (nextRevisionId === null) return "safe_mode";
	return nextRevisionId === currentRevisionId ? "continue" : "reload";
}

function parseRevisionId(value: unknown): string | null | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	const keys = Object.keys(value);
	if (keys.length !== 1 || keys[0] !== "revisionId") return undefined;
	const revisionId = (value as { readonly revisionId?: unknown }).revisionId;
	return revisionId === null || (typeof revisionId === "string" && UuidPattern.test(revisionId))
		? revisionId
		: undefined;
}

async function readBoundedProbeResponse(response: Response): Promise<unknown> {
	const declaredLength = Number(response.headers.get("content-length") ?? 0);
	if (Number.isFinite(declaredLength) && declaredLength > MaximumProbeResponseBytes)
		throw new Error("presentation policy probe response is too large");
	const text = await response.text();
	if (new TextEncoder().encode(text).byteLength > MaximumProbeResponseBytes)
		throw new Error("presentation policy probe response is too large");
	return JSON.parse(text);
}

export interface ActivePresentationPolicyMonitor {
	check(): Promise<void>;
	dispose(): void;
}

/**
 * Best-effort kill/global-disable propagation for an already executing theme.
 * Full-trust code can interfere with browser APIs, so the server remains the
 * authority and a safe full navigation remains the recovery boundary.
 */
export function startActivePresentationPolicyMonitor(input: {
	readonly hostUnitId: string;
	readonly revisionId: string;
	readonly onInvalidated: (nextRevisionId: string | null) => void;
	readonly fetcher?: typeof fetch;
}): ActivePresentationPolicyMonitor {
	const controller = new AbortController();
	const fetcher = input.fetcher ?? fetch;
	let disposed = false;
	let pending = false;
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		controller.abort();
		window.clearInterval(interval);
		document.removeEventListener("visibilitychange", handleVisibilityChange);
		window.removeEventListener("pageshow", handlePageShow);
	};
	const invalidate = (nextRevisionId: string | null) => {
		dispose();
		input.onInvalidated(nextRevisionId);
	};
	const check = async () => {
		if (disposed || pending) return;
		pending = true;
		try {
			const url = new URL(ActivePresentationPolicyProbePath, window.location.href);
			url.searchParams.set("hostUnitId", input.hostUnitId);
			const response = await fetcher(url, {
				cache: "no-store",
				credentials: "same-origin",
				headers: { accept: "application/json" },
				signal: controller.signal,
			});
			if (!response.ok) {
				invalidate(null);
				return;
			}
			const nextRevisionId = parseRevisionId(await readBoundedProbeResponse(response));
			if (nextRevisionId === undefined) {
				invalidate(null);
				return;
			}
			if (nextRevisionId !== input.revisionId) invalidate(nextRevisionId);
		} catch {
			if (!controller.signal.aborted) invalidate(null);
		} finally {
			pending = false;
		}
	};
	const handleVisibilityChange = () => {
		if (document.visibilityState === "visible") void check();
	};
	const handlePageShow = () => void check();
	const interval = window.setInterval(
		() => void check(),
		ActivePresentationPolicyProbeIntervalMilliseconds,
	);
	document.addEventListener("visibilitychange", handleVisibilityChange);
	window.addEventListener("pageshow", handlePageShow);
	return { check, dispose };
}
