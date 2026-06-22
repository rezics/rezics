// Canonical date formatters — single source of truth for absolute date display.
// 规范日期格式化器——绝对日期显示的单一事实来源。

const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function coerce(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "Jun 22, 2026" — date only, medium style. 仅日期，中等样式。 */
export function formatDate(value: string | number | Date): string {
  return dateOnly.format(coerce(value));
}

/** "Jun 22, 2026, 3:45 PM" — date + time, medium + short. 日期+时间。 */
export function formatDateTime(value: string | number | Date): string {
  return dateTime.format(coerce(value));
}
