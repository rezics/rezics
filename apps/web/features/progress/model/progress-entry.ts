import type { GetApiProgressByUnitIdEntriesStatus200 } from "@rezics/openapi-tanstack-query";

import { clampProgress, toProgressStatus, type ProgressStatus } from "./progress-record";

export type ProgressEntry = GetApiProgressByUnitIdEntriesStatus200["items"][number];

export const ProgressEntryKinds = ["update", "completion"] as const;
export type ProgressEntryKind = (typeof ProgressEntryKinds)[number];

export const ProgressDatePrecisions = ["instant", "day", "month", "year", "unknown"] as const;
export type ProgressDatePrecision = (typeof ProgressDatePrecisions)[number];

export const ProgressSourceKinds = ["rezics", "manual", "import"] as const;
export type ProgressSourceKind = (typeof ProgressSourceKinds)[number];

export interface ProgressEntryDraft {
	readonly affectsCurrent: boolean;
	readonly datePrecision: ProgressDatePrecision;
	readonly dateValue: string;
	readonly entryKind: ProgressEntryKind;
	readonly lastNodeId: string;
	readonly percentage: string;
	readonly sourceExternalId: string;
	readonly sourceKind: ProgressSourceKind;
	readonly sourceProvider: string;
	readonly status: ProgressStatus;
	readonly totalMinutes: string;
}

export interface ProgressEntryWrite {
	readonly affectsCurrent: boolean;
	readonly datePrecision: ProgressDatePrecision;
	readonly entryKind: ProgressEntryKind;
	readonly lastContentStructureNodeId: string | null;
	readonly occurredAt: string | null;
	readonly progress: number;
	readonly sourceExternalId: string | null;
	readonly sourceKind: ProgressSourceKind;
	readonly sourceProvider: string | null;
	readonly status: ProgressStatus;
	readonly totalTimeMs: number;
}

export function createProgressEntryDraft(
	entry: ProgressEntry | undefined,
	now = new Date(),
): ProgressEntryDraft {
	if (!entry)
		return {
			affectsCurrent: false,
			datePrecision: "day",
			dateValue: toDateInputValue(now, "day"),
			entryKind: "update",
			lastNodeId: "",
			percentage: "0",
			sourceExternalId: "",
			sourceKind: "manual",
			sourceProvider: "",
			status: "active",
			totalMinutes: "0",
		};
	return {
		affectsCurrent: entry.affectsCurrent,
		datePrecision: entry.datePrecision,
		dateValue: entry.occurredAt
			? toDateInputValue(new Date(entry.occurredAt), entry.datePrecision)
			: "",
		entryKind: entry.entryKind,
		lastNodeId: entry.lastContentStructureNodeId ?? "",
		percentage: String(Math.round(clampProgress(entry.progress) * 100)),
		sourceExternalId: entry.sourceExternalId ?? "",
		sourceKind: entry.sourceKind,
		sourceProvider: entry.sourceProvider ?? "",
		status: toProgressStatus(entry.status),
		totalMinutes: String(Math.round(Math.max(0, Number(entry.totalTimeMs)) / 60_000)),
	};
}

export function createProgressEntryWrite(
	draft: ProgressEntryDraft,
): ProgressEntryWrite | undefined {
	const completion = draft.entryKind === "completion";
	const percentage = completion ? 100 : Number(draft.percentage);
	const totalMinutes = Number(draft.totalMinutes);
	if (
		!Number.isFinite(percentage) ||
		percentage < 0 ||
		percentage > 100 ||
		!Number.isSafeInteger(totalMinutes) ||
		totalMinutes < 0
	)
		return undefined;
	const occurredAt = parseDateInputValue(draft.dateValue, draft.datePrecision);
	if (draft.datePrecision !== "unknown" && !occurredAt) return undefined;
	return {
		affectsCurrent: draft.affectsCurrent,
		datePrecision: draft.datePrecision,
		entryKind: draft.entryKind,
		lastContentStructureNodeId: completion ? null : draft.lastNodeId || null,
		occurredAt,
		progress: percentage / 100,
		sourceExternalId: draft.sourceExternalId.trim() || null,
		sourceKind: draft.sourceKind,
		sourceProvider: draft.sourceProvider.trim() || null,
		status: completion ? "completed" : draft.status,
		totalTimeMs: totalMinutes * 60_000,
	};
}

export function progressDateInputType(
	precision: ProgressDatePrecision,
): "datetime-local" | "date" | "month" | "number" | undefined {
	switch (precision) {
		case "instant":
			return "datetime-local";
		case "day":
			return "date";
		case "month":
			return "month";
		case "year":
			return "number";
		case "unknown":
			return undefined;
	}
}

export function formatProgressEntryDate(
	occurredAt: string | null,
	precision: ProgressDatePrecision,
	locale: string,
	unknownLabel: string,
): string {
	if (!occurredAt || precision === "unknown") return unknownLabel;
	const date = new Date(occurredAt);
	if (Number.isNaN(date.getTime())) return unknownLabel;
	switch (precision) {
		case "instant":
			return new Intl.DateTimeFormat(locale, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(date);
		case "day":
			return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
				date,
			);
		case "month":
			return new Intl.DateTimeFormat(locale, {
				month: "long",
				year: "numeric",
				timeZone: "UTC",
			}).format(date);
		case "year":
			return new Intl.DateTimeFormat(locale, { year: "numeric", timeZone: "UTC" }).format(
				date,
			);
	}
}

function toDateInputValue(date: Date, precision: ProgressDatePrecision): string {
	if (Number.isNaN(date.getTime())) return "";
	if (precision === "instant") {
		const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
		return local.toISOString().slice(0, 16);
	}
	const iso = date.toISOString();
	if (precision === "day") return iso.slice(0, 10);
	if (precision === "month") return iso.slice(0, 7);
	if (precision === "year") return iso.slice(0, 4);
	return "";
}

function parseDateInputValue(value: string, precision: ProgressDatePrecision): string | null {
	if (precision === "unknown") return null;
	const normalized =
		precision === "instant"
			? new Date(value)
			: precision === "day"
				? new Date(`${value}T00:00:00.000Z`)
				: precision === "month"
					? new Date(`${value}-01T00:00:00.000Z`)
					: /^\d{4}$/.test(value)
						? new Date(`${value}-01-01T00:00:00.000Z`)
						: new Date(Number.NaN);
	return Number.isNaN(normalized.getTime()) ? null : normalized.toISOString();
}
