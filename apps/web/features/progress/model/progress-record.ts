export const ProgressStatuses = ["backlog", "active", "paused", "completed", "dropped"] as const;

export type ProgressStatus = (typeof ProgressStatuses)[number];

export function toProgressStatus(value: string): ProgressStatus {
	return ProgressStatuses.find((candidate) => candidate === value) ?? "active";
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
