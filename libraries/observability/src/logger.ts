import { trace } from "@opentelemetry/api";

import type { LogSeverity, ServiceIdentityInput } from "./config";
import { redact, redactString, type SafeJsonValue } from "./redaction";

export interface SafeRequestLogContext {
	method: string;
	route: string;
}

export interface LogDetails {
	eventName?: string;
	errorCode?: string;
	request?: SafeRequestLogContext;
	error?: unknown;
	attributes?: Readonly<Record<string, unknown>>;
}

export interface StructuredLogger {
	debug(message: string, details?: LogDetails): void;
	info(message: string, details?: LogDetails): void;
	warn(message: string, details?: LogDetails): void;
	error(message: string, details?: LogDetails): void;
}

export type LogWriter = (line: string, severity: LogSeverity) => void;

export function getActiveTraceContext():
	{ readonly traceId: string; readonly spanId: string } | undefined {
	const context = trace.getActiveSpan()?.spanContext();
	return context?.traceId && context.spanId
		? { traceId: context.traceId, spanId: context.spanId }
		: undefined;
}

function defaultWriter(line: string, severity: LogSeverity): void {
	const stream = severity === "error" ? process.stderr : process.stdout;
	stream.write(`${line}\n`);
}

export function createStructuredLogger(
	service: Required<ServiceIdentityInput>,
	production: boolean,
	writer: LogWriter = defaultWriter,
): StructuredLogger {
	function write(severity: LogSeverity, message: string, details: LogDetails = {}): void {
		const spanContext = getActiveTraceContext();
		const event: Record<string, SafeJsonValue> = {
			timestamp: new Date().toISOString(),
			severity,
			message: redactString(message).slice(0, 1_024),
			service: service.name,
			environment: service.environment,
		};
		if (spanContext?.traceId) event.trace_id = spanContext.traceId;
		if (spanContext?.spanId) event.span_id = spanContext.spanId;
		if (details.eventName) event.event_name = redactString(details.eventName).slice(0, 120);
		if (details.errorCode) event.error_code = redactString(details.errorCode).slice(0, 120);
		if (details.request)
			event.request = {
				method: details.request.method.slice(0, 16),
				route: details.request.route.slice(0, 240),
			};
		if (details.error !== undefined) event.error = redact(details.error, production);
		if (details.attributes) event.attributes = redact(details.attributes, production);
		try {
			writer(JSON.stringify(event), severity);
		} catch {
			// Telemetry output is best-effort and must never fail application work.
		}
	}

	return {
		debug: (message, details) => write("debug", message, details),
		info: (message, details) => write("info", message, details),
		warn: (message, details) => write("warn", message, details),
		error: (message, details) => write("error", message, details),
	};
}
