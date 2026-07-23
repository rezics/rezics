export function toFiniteApiNumber(value: string | number | null | undefined): number | undefined {
	if (value === null || value === undefined) return undefined;
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function toNonNegativeApiInteger(value: string | number | null | undefined): number {
	const parsed = toFiniteApiNumber(value);
	return parsed !== undefined && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}
