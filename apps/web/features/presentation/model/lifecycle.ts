export interface UnitPresentationContextV0 {
	readonly hostUnit: {
		readonly id: string;
		readonly kind: "zone";
	};
	readonly targetContract: "rezics.unit.presentation@0";
	readonly headerRoot: HTMLElement;
	readonly mainRoot: HTMLElement;
	readonly footerRoot: HTMLElement;
	readonly signal: AbortSignal;
}

export type MountUnitPresentationV0 = (
	context: UnitPresentationContextV0,
) => void | (() => void) | Promise<void | (() => void)>;

export type UnitPresentationRuntimePhase =
	| "loading"
	| "active"
	| "resource_summary"
	| "pre_execution_failure"
	| "post_execution_failure"
	| "runtime_error"
	| "unhandled_rejection"
	| "long_task"
	| "cleanup_failure"
	| "disposed";

export interface UnitPresentationRuntimeEventDetail {
	readonly contract: "rezics.unit.presentation@0";
	readonly executionMode: "host_full_trust";
	readonly hostUnitId: string;
	readonly phase: UnitPresentationRuntimePhase;
	readonly revisionId: string;
	readonly reason?: string;
	readonly durationMilliseconds?: number;
	readonly resourceCount?: number;
	readonly failureCount?: number;
}

export const UnitPresentationRuntimeEventName = "rezics:unit-presentation-runtime";
const UnitPresentationRuntimeReportPath = "/__rezics/presentation-runtime-report";
const MaximumRuntimeReportsPerActivation = 32;
const MaximumRuntimeReportBytes = 2_048;
let reportedRevisionId = "";
let reportCount = 0;

export function emitUnitPresentationRuntimeEvent(detail: UnitPresentationRuntimeEventDetail): void {
	window.dispatchEvent(
		new CustomEvent<UnitPresentationRuntimeEventDetail>(UnitPresentationRuntimeEventName, {
			detail,
		}),
	);
	if (detail.phase === "loading" || detail.revisionId !== reportedRevisionId) {
		reportedRevisionId = detail.revisionId;
		reportCount = 0;
	}
	if (reportCount >= MaximumRuntimeReportsPerActivation) return;
	const body = JSON.stringify(detail);
	if (new TextEncoder().encode(body).byteLength > MaximumRuntimeReportBytes) return;
	reportCount += 1;
	try {
		void fetch(UnitPresentationRuntimeReportPath, {
			method: "POST",
			body,
			cache: "no-store",
			credentials: "omit",
			headers: { "content-type": "application/json" },
			keepalive: true,
		}).catch(() => undefined);
	} catch {
		// Full-trust code can replace browser APIs; runtime telemetry is best effort.
	}
}
