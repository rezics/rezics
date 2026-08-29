const UuidPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const ReasonPattern = /^[a-z0-9_]{1,64}$/;
const RuntimePhases = new Set([
	"loading",
	"active",
	"resource_summary",
	"pre_execution_failure",
	"post_execution_failure",
	"runtime_error",
	"unhandled_rejection",
	"long_task",
	"cleanup_failure",
	"disposed",
]);

export const PresentationRuntimeReportPath = "/__rezics/presentation-runtime-report";
export const MaximumPresentationRuntimeReportBytes = 2_048;

interface PresentationRuntimeReport {
	readonly contract: "rezics.unit.presentation@0";
	readonly executionMode: "host_full_trust";
	readonly hostUnitId: string;
	readonly phase: string;
	readonly revisionId: string;
	readonly reason?: string;
	readonly durationMilliseconds?: number;
	readonly resourceCount?: number;
	readonly failureCount?: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedCount(value: unknown): value is number {
	return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1_024;
}

function parseRuntimeReport(value: unknown): PresentationRuntimeReport | undefined {
	if (!isObject(value)) return undefined;
	const allowedKeys = new Set([
		"contract",
		"executionMode",
		"hostUnitId",
		"phase",
		"revisionId",
		"reason",
		"durationMilliseconds",
		"resourceCount",
		"failureCount",
	]);
	if (Object.keys(value).some((key) => !allowedKeys.has(key))) return undefined;
	if (
		value.contract !== "rezics.unit.presentation@0" ||
		value.executionMode !== "host_full_trust" ||
		typeof value.hostUnitId !== "string" ||
		!UuidPattern.test(value.hostUnitId) ||
		typeof value.revisionId !== "string" ||
		!UuidPattern.test(value.revisionId) ||
		typeof value.phase !== "string" ||
		!RuntimePhases.has(value.phase)
	)
		return undefined;
	if (
		value.reason !== undefined &&
		(typeof value.reason !== "string" || !ReasonPattern.test(value.reason))
	)
		return undefined;
	if (
		value.durationMilliseconds !== undefined &&
		(typeof value.durationMilliseconds !== "number" ||
			!Number.isFinite(value.durationMilliseconds) ||
			value.durationMilliseconds < 0 ||
			value.durationMilliseconds > 3_600_000)
	)
		return undefined;
	if (value.resourceCount !== undefined && !isBoundedCount(value.resourceCount)) return undefined;
	if (value.failureCount !== undefined && !isBoundedCount(value.failureCount)) return undefined;
	return {
		contract: "rezics.unit.presentation@0",
		executionMode: "host_full_trust",
		hostUnitId: value.hostUnitId,
		phase: value.phase,
		revisionId: value.revisionId,
		...(value.reason === undefined ? {} : { reason: value.reason }),
		...(value.durationMilliseconds === undefined
			? {}
			: { durationMilliseconds: value.durationMilliseconds }),
		...(value.resourceCount === undefined ? {} : { resourceCount: value.resourceCount }),
		...(value.failureCount === undefined ? {} : { failureCount: value.failureCount }),
	};
}

export function isPresentationRuntimeReportRequest(request: Request): boolean {
	return (
		request.method === "POST" && new URL(request.url).pathname === PresentationRuntimeReportPath
	);
}

export async function handlePresentationRuntimeReportRequest(request: Request): Promise<Response> {
	const declaredLength = Number(request.headers.get("content-length") ?? 0);
	if (Number.isFinite(declaredLength) && declaredLength > MaximumPresentationRuntimeReportBytes)
		return Response.json({ error: "request_too_large" }, { status: 413 });
	let report: PresentationRuntimeReport | undefined;
	try {
		const text = await request.text();
		if (new TextEncoder().encode(text).byteLength > MaximumPresentationRuntimeReportBytes)
			return Response.json({ error: "request_too_large" }, { status: 413 });
		report = parseRuntimeReport(JSON.parse(text));
	} catch {
		return Response.json({ error: "request_invalid" }, { status: 400 });
	}
	if (!report) return Response.json({ error: "request_invalid" }, { status: 400 });
	console.info(JSON.stringify({ event: "unit_presentation_runtime", ...report }));
	return new Response(null, {
		status: 204,
		headers: {
			"cache-control": "private, no-store",
			"cross-origin-resource-policy": "same-origin",
		},
	});
}
