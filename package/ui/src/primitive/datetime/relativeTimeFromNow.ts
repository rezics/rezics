// Single source of truth for "x ago" / relative timestamps across the app.
// 全站「x 前」相对时间的单一事实来源。
//
// Built on the platform-native Intl.RelativeTimeFormat best-fit ladder, so every
// surface gets identical thresholds and CLDR-correct localization in all locales,
// without any hand-maintained per-bucket translation strings.
// 基于平台原生 Intl.RelativeTimeFormat 的最佳单位阶梯，让每个界面共享同一套阈值，
// 并在所有语言下获得 CLDR 正确的本地化，无需任何手维护的分档翻译串。

/** Any timestamp shape a caller might hold. 调用方可能持有的任意时间形态。 */
export type RelativeTimeInput = string | number | Date;

/** Resolved pieces ready to feed a semantic `<time>` element. 喂给语义 <time> 的解析结果。 */
export type RelativeTimeParts = {
  /** Localized relative phrase, e.g. "3 minutes ago" / "3分钟前". 本地化相对短语。 */
  readonly relative: string;
  /** Localized absolute timestamp for the tooltip/`title`. 用于 tooltip 的本地化绝对时间。 */
  readonly absolute: string;
  /** Canonical ISO string for the `<time dateTime>` attribute. 用于 dateTime 的 ISO 串。 */
  readonly iso: string;
};

export type RelativeTimeOptions = {
  /** Reference "now" in ms; injectable for deterministic tests. 参考「现在」（ms），便于确定性测试。 */
  readonly now?: number;
  /** BCP-47 locale; defaults to the runtime's. BCP-47 语言；默认取运行时。 */
  readonly locale?: string;
};

/** One rung of the best-fit ladder: how many of `unit` make the next-larger unit. */
/** 阶梯的一档：多少个 `unit` 组成上一级单位。 */
type Division = {
  readonly amount: number;
  readonly unit: Intl.RelativeTimeFormatUnit;
};

const DIVISIONS: readonly Division[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

// Sub-`JUST_NOW` deltas collapse to the locale's "now" word so fresh items read
// cleanly instead of flickering "3 seconds ago".
// 不足 JUST_NOW 的差值归并为本地化「现在」，让新内容读起来干净，不闪 "3 秒前"。
const JUST_NOW_SECONDS = 30;

/**
 * Resolve any timestamp input to a valid Date, or null when unparseable.
 * 把任意时间输入归一为合法 Date；无法解析时返回 null。
 */
function toDate(value: RelativeTimeInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Pick the best-fit unit for a signed second delta and format it with
 * Intl.RelativeTimeFormat (numeric: "auto", giving "yesterday"/"last week").
 * 为带符号的秒差选择最佳单位，并用 Intl.RelativeTimeFormat 格式化
 * （numeric: "auto"，可产出 "yesterday"/"last week" 等自然措辞）。
 */
function formatBestFit(deltaSeconds: number, locale?: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(deltaSeconds) < JUST_NOW_SECONDS) return rtf.format(0, "second");
  let duration = deltaSeconds;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), "year");
}

/**
 * Format a timestamp as a single localized relative phrase plus its absolute
 * form. Returns null for unparseable input so callers can render nothing.
 * 把时间格式化为本地化相对短语 + 绝对时间；输入无法解析时返回 null，调用方可不渲染。
 */
export function relativeTimeFromNow(
  value: RelativeTimeInput,
  options: RelativeTimeOptions = {},
): RelativeTimeParts | null {
  const date = toDate(value);
  if (!date) return null;
  const now = options.now ?? Date.now();
  const relative = formatBestFit((date.getTime() - now) / 1000, options.locale);
  const absolute = new Intl.DateTimeFormat(options.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
  return { relative, absolute, iso: date.toISOString() };
}
