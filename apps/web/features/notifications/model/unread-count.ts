import type {
	GetApiNotificationsStatus200,
	GetApiNotificationsUnreadCountStatus200,
} from "@rezics/openapi-tanstack-query";

export type UnreadCountResult =
	| GetApiNotificationsStatus200["unreadCount"]
	| GetApiNotificationsUnreadCountStatus200["count"]
	| string
	| number;

export function normalizeUnreadCount(value: UnreadCountResult | undefined): number {
	const rawValue = typeof value === "object" && value !== null ? value.value : value;
	const count = typeof rawValue === "number" ? rawValue : Number(rawValue);
	return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

export function formatUnreadCount(value: UnreadCountResult | undefined): string {
	const count = normalizeUnreadCount(value);
	return count > 99 ? "99+" : String(count);
}
