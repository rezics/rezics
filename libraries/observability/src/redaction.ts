import type { Attributes } from "@opentelemetry/api";
import { ExportResultCode } from "@opentelemetry/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

const Redacted = "[REDACTED]";
const SensitiveKey =
	/(?:^|[._-])(authorization|body|cookie|credential|email|object.?key|parameters|params|password|query|secret|session|signature|signed.?url|sql|statement|token|unit.?id|user.?id|profile.?id)(?:$|[._-])/i;
const StackKey = /(?:^|[._-])(stack|stacktrace)(?:$|[._-])/i;
const UrlKey = /(?:^|[._-])(uri|url)(?:$|[._-])/i;
const CorrelationKey = /^(requestId|request_id)$/;
const EmailAddress = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BearerCredential = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const SensitiveAssignment =
	/\b(access_token|api[_-]?key|authorization|code|cookie|credential|password|refresh_token|secret|session|signature|token)=([^\s&,;]+)/gi;
const UrlCandidate = /https?:\/\/[^\s"'<>]+/gi;
const Uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const EmbeddedDatabaseQuery =
	/Failed query:[\s\S]*?(?:\nparams:[^\n]*)?(?=\n\s+at\s|\nCaused by:|$)/g;

export type SafeJsonValue =
	| null
	| boolean
	| number
	| string
	| readonly SafeJsonValue[]
	| { readonly [key: string]: SafeJsonValue };

function safeUrl(value: string): string {
	try {
		const url = new URL(value);
		url.username = "";
		url.password = "";
		url.search = "";
		url.hash = "";
		return url.origin;
	} catch {
		return Redacted;
	}
}

export function redactString(value: string): string {
	return value
		.replace(EmbeddedDatabaseQuery, "Database query failed")
		.replace(BearerCredential, "Bearer [REDACTED]")
		.replace(SensitiveAssignment, "$1=[REDACTED]")
		.replace(EmailAddress, "[REDACTED_EMAIL]")
		.replace(Uuid, "[REDACTED_ID]")
		.replace(UrlCandidate, (candidate) => safeUrl(candidate));
}

function normalizeError(
	error: Error,
	production: boolean,
	seen: WeakSet<object>,
): { readonly [key: string]: SafeJsonValue } {
	const normalized: Record<string, SafeJsonValue> = {
		type: redactString(error.name || "Error"),
		message: redactString(error.message || "Unknown error"),
	};
	if (!production && error.stack) normalized.stack = redactString(error.stack);
	if (error.cause !== undefined) normalized.cause = redactValue(error.cause, production, seen, 1);
	return normalized;
}

function redactValue(
	value: unknown,
	production: boolean,
	seen: WeakSet<object>,
	depth: number,
): SafeJsonValue {
	if (value === null || value === undefined) return null;
	if (typeof value === "string") return redactString(value).slice(0, 4_096);
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
	if (typeof value === "bigint") return value.toString();
	if (typeof value === "symbol" || typeof value === "function") return `[${typeof value}]`;
	if (depth >= 8) return "[MAX_DEPTH]";
	if (value instanceof Date)
		return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
	if (value instanceof URL) return safeUrl(value.toString());
	if (value instanceof Error) return normalizeError(value, production, seen);
	if (seen.has(value)) return "[CIRCULAR]";
	seen.add(value);
	if (Array.isArray(value))
		return value.slice(0, 20).map((entry) => redactValue(entry, production, seen, depth + 1));
	if (value instanceof Headers) {
		const headers: Record<string, SafeJsonValue> = {};
		for (const [key, headerValue] of value.entries())
			headers[key] = SensitiveKey.test(key) ? Redacted : redactString(headerValue);
		return headers;
	}
	const record: Record<string, SafeJsonValue> = {};
	for (const [key, entry] of Object.entries(value).slice(0, 50)) {
		if (SensitiveKey.test(key)) {
			record[key] = Redacted;
			continue;
		}
		if (production && StackKey.test(key)) continue;
		if (CorrelationKey.test(key) && typeof entry === "string") {
			record[key] = entry.slice(0, 128);
			continue;
		}
		if (UrlKey.test(key) && typeof entry === "string") {
			record[key] = safeUrl(entry);
			continue;
		}
		record[key] = redactValue(entry, production, seen, depth + 1);
	}
	return record;
}

export function redact(value: unknown, production: boolean): SafeJsonValue {
	return redactValue(value, production, new WeakSet<object>(), 0);
}

const SafeSpanAttribute = new Set([
	"dependency.name",
	"dependency.operation",
	"error.type",
	"http.request.method",
	"http.response.status_code",
	"http.route",
	"job.name",
	"job.result",
	"job.retry_count",
	"network.protocol.name",
	"network.protocol.version",
	"server.address",
	"server.port",
	"db.system.name",
	"db.operation.name",
]);

function sanitizeSpanAttributes(
	attributes: Attributes,
	production: boolean,
	event = false,
): Attributes {
	const sanitized: Attributes = {};
	for (const [key, value] of Object.entries(attributes)) {
		const exceptionAttribute = event && key.startsWith("exception.");
		if (!SafeSpanAttribute.has(key) && !exceptionAttribute) continue;
		if (production && StackKey.test(key)) continue;
		if (typeof value === "string") sanitized[key] = redactString(value).slice(0, 1_024);
		else sanitized[key] = value;
	}
	return sanitized;
}

function sanitizeSpan(span: ReadableSpan, production: boolean): ReadableSpan {
	return {
		name: redactString(span.name).slice(0, 120),
		kind: span.kind,
		spanContext: () => span.spanContext(),
		parentSpanContext: span.parentSpanContext,
		startTime: span.startTime,
		endTime: span.endTime,
		status: {
			...span.status,
			message: span.status.message ? redactString(span.status.message).slice(0, 1_024) : undefined,
		},
		attributes: sanitizeSpanAttributes(span.attributes, production),
		events: span.events.map((event) => ({
			...event,
			name: redactString(event.name).slice(0, 120),
			attributes: event.attributes
				? sanitizeSpanAttributes(event.attributes, production, true)
				: undefined,
		})),
		links: span.links.map((link) => ({
			context: link.context,
			attributes: link.attributes ? sanitizeSpanAttributes(link.attributes, production) : undefined,
		})),
		duration: span.duration,
		ended: span.ended,
		resource: span.resource,
		instrumentationScope: span.instrumentationScope,
		droppedAttributesCount: span.droppedAttributesCount,
		droppedEventsCount: span.droppedEventsCount,
		droppedLinksCount: span.droppedLinksCount,
	};
}

export class RedactingSpanExporter implements SpanExporter {
	readonly #delegate: SpanExporter;
	readonly #production: boolean;
	readonly #reportFailure: (error: unknown) => void;

	constructor(
		delegate: SpanExporter,
		production: boolean,
		reportFailure: (error: unknown) => void,
	) {
		this.#delegate = delegate;
		this.#production = production;
		this.#reportFailure = reportFailure;
	}

	export(spans: ReadableSpan[], resultCallback: Parameters<SpanExporter["export"]>[1]): void {
		this.#delegate.export(
			spans.map((span) => sanitizeSpan(span, this.#production)),
			(result) => {
				if (result.code === ExportResultCode.FAILED) this.#reportFailure(result.error);
				resultCallback(result);
			},
		);
	}

	forceFlush(): Promise<void> {
		return this.#delegate.forceFlush?.() ?? Promise.resolve();
	}

	shutdown(): Promise<void> {
		return this.#delegate.shutdown();
	}
}
