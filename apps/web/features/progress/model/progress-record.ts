import {
	DefaultResourceVisibility,
	type ResourceVisibility,
} from "@/features/privacy/model/resource-visibility";

export const ProgressStatuses = ["backlog", "active", "paused", "completed", "dropped"] as const;

export type ProgressStatus = (typeof ProgressStatuses)[number];

export type UnitProgressDomain =
	| { readonly type: "book"; readonly unitId: string }
	| { readonly type: "media"; readonly unitId: string }
	| { readonly type: "software"; readonly unitId: string };

export interface UnitProgressRecord<Status extends ProgressStatus = ProgressStatus> {
	readonly completedCount: number;
	readonly lastContentStructureNodeId: string | null;
	readonly progress: number;
	readonly status: Status;
	readonly totalTimeMs: number;
	readonly visibility: ResourceVisibility;
}

export type TrackedUnitProgressState = {
	[Status in ProgressStatus]: {
		readonly kind: Status;
		readonly record: UnitProgressRecord<Status>;
	};
}[ProgressStatus];

export interface ProgressDraft {
	readonly lastNodeId: string;
	readonly percentage: string;
	readonly status: ProgressStatus;
	readonly totalMinutes: string;
}

export interface UnitProgressUpdate {
	readonly lastContentStructureNodeId?: string | null;
	readonly progress: number;
	readonly status: ProgressStatus;
	readonly totalTimeMs?: number;
	readonly visibility?: ResourceVisibility;
}

const EmptyProgressRecord: UnitProgressRecord = {
	completedCount: 0,
	lastContentStructureNodeId: null,
	progress: 0,
	status: "active",
	totalTimeMs: 0,
	visibility: DefaultResourceVisibility,
};
const MaximumTotalMinutes = Math.floor(Number.MAX_SAFE_INTEGER / 60_000);

export function toProgressStatus(value: string): ProgressStatus {
	return ProgressStatuses.find((candidate) => candidate === value) ?? "active";
}

export function clampProgress(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

export function createProgressDraft(record: UnitProgressRecord | null): ProgressDraft {
	const source = record ?? EmptyProgressRecord;
	return {
		status: source.status,
		percentage: String(Math.round(clampProgress(source.progress) * 100)),
		totalMinutes: String(Math.round(Math.max(0, source.totalTimeMs) / 60_000)),
		lastNodeId: source.lastContentStructureNodeId ?? "",
	};
}

export function changeProgressDraftStatus(
	draft: ProgressDraft,
	nextStatus: ProgressStatus,
	sourceRecord: UnitProgressRecord | null,
): ProgressDraft {
	const startsNewAttempt =
		sourceRecord?.status === "completed" &&
		draft.status === "completed" &&
		nextStatus !== "completed";
	if (startsNewAttempt || nextStatus === "backlog")
		return {
			...draft,
			status: nextStatus,
			percentage: "0",
			lastNodeId: "",
		};
	return { ...draft, status: nextStatus };
}

export function isCompletionTransition(
	record: UnitProgressRecord | null,
	nextStatus: ProgressStatus,
): boolean {
	return nextStatus === "completed" && record?.status !== "completed";
}

export function completeProgressOptimistically(
	record: UnitProgressRecord | null,
): UnitProgressRecord<"completed"> {
	const source = record ?? EmptyProgressRecord;
	return {
		...source,
		completedCount: source.completedCount + 1,
		lastContentStructureNodeId: null,
		progress: 1,
		status: "completed",
	};
}

export function createBacklogUpdate(type: UnitProgressDomain["type"]): UnitProgressUpdate {
	return {
		status: "backlog",
		progress: 0,
		...(type === "book" ? { lastContentStructureNodeId: null } : {}),
	};
}

export function createRereadUpdate(type: UnitProgressDomain["type"]): UnitProgressUpdate {
	return {
		status: "active",
		progress: 0,
		...(type === "book" ? { lastContentStructureNodeId: null } : {}),
	};
}

export function createResumeUpdate(
	type: UnitProgressDomain["type"],
	record: UnitProgressRecord,
): UnitProgressUpdate {
	return {
		status: "active",
		progress: type === "software" ? 0 : record.progress,
		...(type === "book"
			? { lastContentStructureNodeId: record.lastContentStructureNodeId }
			: { totalTimeMs: record.totalTimeMs }),
	};
}

export function toTrackedUnitProgressState(record: UnitProgressRecord): TrackedUnitProgressState {
	switch (record.status) {
		case "backlog":
			return { kind: "backlog", record: { ...record, status: "backlog" } };
		case "active":
			return { kind: "active", record: { ...record, status: "active" } };
		case "paused":
			return { kind: "paused", record: { ...record, status: "paused" } };
		case "completed":
			return { kind: "completed", record: { ...record, status: "completed" } };
		case "dropped":
			return { kind: "dropped", record: { ...record, status: "dropped" } };
	}
}

export function createProgressUpdate(
	type: UnitProgressDomain["type"],
	draft: ProgressDraft,
): UnitProgressUpdate | undefined {
	if (type === "software") {
		const totalMinutes = parseTotalMinutes(draft.totalMinutes);
		if (totalMinutes === undefined) return undefined;
		return {
			status: draft.status,
			progress: draft.status === "completed" ? 1 : 0,
			totalTimeMs: totalMinutes * 60_000,
		};
	}

	const atBoundary = draft.status === "backlog" || draft.status === "completed";
	const percentage = atBoundary
		? draft.status === "completed"
			? 100
			: 0
		: parseBoundedNumber(draft.percentage, {
				minimum: 0,
				maximum: 100,
			});
	if (percentage === undefined) return undefined;
	const progress = percentage / 100;

	if (type === "book") {
		return {
			status: draft.status,
			progress,
			lastContentStructureNodeId: atBoundary ? null : draft.lastNodeId || null,
		};
	}

	const totalMinutes = parseTotalMinutes(draft.totalMinutes);
	if (totalMinutes === undefined) return undefined;
	return {
		status: draft.status,
		progress,
		totalTimeMs: totalMinutes * 60_000,
	};
}

export function parseBoundedNumber(
	value: string,
	{ maximum, minimum }: { minimum: number; maximum?: number },
): number | undefined {
	if (!value.trim()) return undefined;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < minimum || (maximum !== undefined && parsed > maximum))
		return undefined;
	return parsed;
}

export function parseNonNegativeInteger(value: string): number | undefined {
	const parsed = parseBoundedNumber(value, { minimum: 0 });
	return parsed !== undefined && Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseTotalMinutes(value: string): number | undefined {
	const parsed = parseNonNegativeInteger(value);
	return parsed !== undefined && parsed <= MaximumTotalMinutes ? parsed : undefined;
}
