import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import type { PostApiProgressImportBody } from "@rezics/openapi-tanstack-query";

import {
	ProgressDatePrecisions,
	ProgressEntryKinds,
	type ProgressDatePrecision,
} from "./progress-entry";
import { ProgressStatuses } from "./progress-record";

export const ProgressImportHeader = verbatimTerms.progressCsvHeader.value;
export const ProgressImportHeaders = ProgressImportHeader.split(",");

export type ProgressImportResult =
	| { readonly kind: "success"; readonly items: PostApiProgressImportBody["items"] }
	| { readonly kind: "failure"; readonly line: number };

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseProgressImportCsv(source: string): ProgressImportResult {
	const rows = parseCsvRows(source);
	if (!rows.length) return { kind: "failure", line: 1 };
	const headers = rows[0]?.map((value) => value.trim().replace(/^\uFEFF/, "")) ?? [];
	if (
		headers.length !== ProgressImportHeaders.length ||
		!ProgressImportHeaders.every((header, index) => headers[index] === header)
	)
		return { kind: "failure", line: 1 };

	const items: PostApiProgressImportBody["items"] = [];
	for (const [index, row] of rows.slice(1).entries()) {
		if (row.every((value) => !value.trim())) continue;
		if (items.length >= 500) return { kind: "failure", line: index + 2 };
		const parsed = parseProgressImportRow(row);
		if (!parsed) return { kind: "failure", line: index + 2 };
		items.push(parsed);
	}
	return items.length ? { kind: "success", items } : { kind: "failure", line: 2 };
}

function parseProgressImportRow(
	row: readonly string[],
): PostApiProgressImportBody["items"][number] | undefined {
	if (row.length !== ProgressImportHeaders.length) return undefined;
	type ImportColumns = [
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
		string,
	];
	const [
		unitId,
		entryKindValue,
		statusValue,
		progressValue,
		occurredAtValue,
		datePrecisionValue,
		totalTimeMsValue,
		sourceExternalIdValue,
		affectsCurrentValue,
		lastContentStructureNodeIdValue,
	] = row.map((value) => value.trim()) as ImportColumns;
	const entryKind = ProgressEntryKinds.find((value) => value === entryKindValue);
	const status = ProgressStatuses.find((value) => value === statusValue);
	const datePrecision = ProgressDatePrecisions.find((value) => value === datePrecisionValue);
	const progress = Number(progressValue);
	const totalTimeMs = totalTimeMsValue ? Number(totalTimeMsValue) : 0;
	const affectsCurrent = affectsCurrentValue.toLowerCase() === "true";
	if (
		!UuidPattern.test(unitId ?? "") ||
		!entryKind ||
		!status ||
		!datePrecision ||
		!Number.isFinite(progress) ||
		progress < 0 ||
		progress > 1 ||
		!Number.isSafeInteger(totalTimeMs) ||
		totalTimeMs < 0 ||
		!["true", "false"].includes(affectsCurrentValue.toLowerCase()) ||
		(lastContentStructureNodeIdValue && !UuidPattern.test(lastContentStructureNodeIdValue))
	)
		return undefined;
	const occurredAt = normalizeImportDate(occurredAtValue, datePrecision);
	if (datePrecision !== "unknown" && !occurredAt) return undefined;
	return {
		unitId,
		entryKind,
		status: entryKind === "completion" ? "completed" : status,
		progress: entryKind === "completion" ? 1 : progress,
		totalTimeMs,
		lastContentStructureNodeId: lastContentStructureNodeIdValue || null,
		occurredAt,
		datePrecision,
		sourceExternalId: sourceExternalIdValue || null,
		affectsCurrent,
	};
}

function normalizeImportDate(value: string, precision: ProgressDatePrecision): string | null {
	if (precision === "unknown") return value ? null : null;
	const date =
		precision === "instant"
			? new Date(value)
			: precision === "day"
				? new Date(`${value}T00:00:00.000Z`)
				: precision === "month"
					? new Date(`${value}-01T00:00:00.000Z`)
					: /^\d{4}$/.test(value)
						? new Date(`${value}-01-01T00:00:00.000Z`)
						: new Date(Number.NaN);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseCsvRows(source: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	for (let index = 0; index < source.length; index += 1) {
		const character = source[index];
		if (character === '"') {
			if (quoted && source[index + 1] === '"') {
				field += '"';
				index += 1;
			} else quoted = !quoted;
		} else if (character === "," && !quoted) {
			row.push(field);
			field = "";
		} else if ((character === "\n" || character === "\r") && !quoted) {
			if (character === "\r" && source[index + 1] === "\n") index += 1;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else field += character;
	}
	if (quoted) return [];
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}
