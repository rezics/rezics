import type { UiLocale } from "@rezics/i18n";

type DateTimeInput = string | number | Date;

function timestampOf(value: DateTimeInput, field: string): number {
	const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
	if (!Number.isFinite(timestamp))
		throw new RangeError(`${field} must be a valid date or timestamp.`);
	return timestamp;
}

export function formatRelativeTime(
	value: string | Date,
	locale: UiLocale,
	referenceTime: DateTimeInput = Date.now(),
): string {
	const elapsed = timestampOf(referenceTime, "referenceTime") - timestampOf(value, "value");
	const direction = elapsed < 0 ? 1 : -1;
	const minutes = Math.max(1, Math.floor(Math.abs(elapsed) / 60_000));
	const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "narrow" });
	if (minutes < 60) return formatter.format(direction * minutes, "minute");
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return formatter.format(direction * hours, "hour");
	return formatter.format(direction * Math.floor(hours / 24), "day");
}
