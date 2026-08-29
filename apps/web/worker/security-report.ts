export const SecurityReportPath = "/__rezics/security-report";
export const MaximumSecurityReportBytes = 64 * 1_024;
const MaximumReportsPerRequest = 32;

type SecurityReportSummary = Readonly<Record<string, string | number | boolean>>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maximumLength: number): string | undefined {
	return typeof value === "string" && value.length > 0 ? value.slice(0, maximumLength) : undefined;
}

function safeReportedUrl(value: unknown): string | undefined {
	const candidate = boundedString(value, 4_096);
	if (!candidate) return undefined;
	if (["inline", "eval", "data", "blob"].some((prefix) => candidate.startsWith(prefix)))
		return candidate.split(":", 1)[0]?.slice(0, 32);
	try {
		const url = new URL(candidate);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		return `${url.origin}${url.pathname}`.slice(0, 1_000);
	} catch {
		return undefined;
	}
}

function copyString(
	target: Record<string, string | number | boolean>,
	key: string,
	value: unknown,
	maximumLength = 200,
): void {
	const selected = boundedString(value, maximumLength);
	if (selected) target[key] = selected;
}

function copyNumber(
	target: Record<string, string | number | boolean>,
	key: string,
	value: unknown,
): void {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0)
		target[key] = Math.min(Math.trunc(value), Number.MAX_SAFE_INTEGER);
}

function summarizeModernReport(report: Record<string, unknown>): SecurityReportSummary {
	const summary: Record<string, string | number | boolean> = {};
	copyString(summary, "type", report.type, 64);
	copyNumber(summary, "age", report.age);
	const documentUrl = safeReportedUrl(report.url);
	if (documentUrl) summary.documentUrl = documentUrl;
	if (!isRecord(report.body)) return summary;
	const body = report.body;
	const bodyDocumentUrl = safeReportedUrl(body.documentURL);
	const blockedUrl = safeReportedUrl(body.blockedURL);
	if (bodyDocumentUrl) summary.documentUrl = bodyDocumentUrl;
	if (blockedUrl) summary.blockedUrl = blockedUrl;
	copyString(summary, "effectiveDirective", body.effectiveDirective, 100);
	copyString(summary, "violatedDirective", body.violatedDirective, 200);
	copyString(summary, "destination", body.destination, 64);
	copyString(summary, "disposition", body.disposition, 32);
	copyNumber(summary, "statusCode", body.statusCode);
	copyNumber(summary, "lineNumber", body.lineNumber);
	copyNumber(summary, "columnNumber", body.columnNumber);
	if (typeof body.reportOnly === "boolean") summary.reportOnly = body.reportOnly;
	return summary;
}

function summarizeLegacyCspReport(report: Record<string, unknown>): SecurityReportSummary {
	const body = isRecord(report["csp-report"])
		? (report["csp-report"] as Record<string, unknown>)
		: report;
	const summary: Record<string, string | number | boolean> = { type: "csp-violation" };
	const documentUrl = safeReportedUrl(body["document-uri"]);
	const blockedUrl = safeReportedUrl(body["blocked-uri"]);
	if (documentUrl) summary.documentUrl = documentUrl;
	if (blockedUrl) summary.blockedUrl = blockedUrl;
	copyString(summary, "effectiveDirective", body["effective-directive"], 100);
	copyString(summary, "violatedDirective", body["violated-directive"], 200);
	copyString(summary, "disposition", body.disposition, 32);
	copyNumber(summary, "statusCode", body["status-code"]);
	copyNumber(summary, "lineNumber", body["line-number"]);
	copyNumber(summary, "columnNumber", body["column-number"]);
	return summary;
}

export function summarizeSecurityReports(value: unknown): readonly SecurityReportSummary[] {
	const candidates = Array.isArray(value) ? value : [value];
	return candidates
		.slice(0, MaximumReportsPerRequest)
		.filter(isRecord)
		.map((report) =>
			"csp-report" in report ? summarizeLegacyCspReport(report) : summarizeModernReport(report),
		)
		.filter((report) => Object.keys(report).length > 0);
}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
	const declaredLength = Number(request.headers.get("content-length") ?? 0);
	if (Number.isFinite(declaredLength) && declaredLength > MaximumSecurityReportBytes)
		throw new RangeError("security report exceeds its byte limit");
	if (!request.body) return new Uint8Array();
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		byteLength += value.byteLength;
		if (byteLength > MaximumSecurityReportBytes) {
			await reader.cancel().catch(() => undefined);
			throw new RangeError("security report exceeds its byte limit");
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export function isSecurityReportRequest(request: Request): boolean {
	return request.method === "POST" && new URL(request.url).pathname === SecurityReportPath;
}

export async function handleSecurityReportRequest(request: Request): Promise<Response> {
	const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
	if (
		!["application/reports+json", "application/csp-report", "application/json"].includes(
			contentType ?? "",
		)
	)
		return new Response(null, { status: 415, headers: { "cache-control": "no-store" } });
	try {
		const bytes = await readBoundedBody(request);
		const parsed = JSON.parse(
			new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes),
		);
		for (const report of summarizeSecurityReports(parsed))
			console.warn(JSON.stringify({ event: "browser_security_policy_report", ...report }));
		return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
	} catch (error) {
		return new Response(null, {
			status: error instanceof RangeError ? 413 : 400,
			headers: { "cache-control": "no-store" },
		});
	}
}
