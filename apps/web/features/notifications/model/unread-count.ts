export function normalizeUnreadCount(value: string | number | undefined): number {
	const count = typeof value === "number" ? value : Number(value);
	return Number.isSafeInteger(count) && count > 0 ? count : 0;
}
