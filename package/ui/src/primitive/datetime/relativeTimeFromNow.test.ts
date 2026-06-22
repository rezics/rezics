import { describe, expect, test } from "bun:test";
import { relativeTimeFromNow } from "./relativeTimeFromNow";

// A fixed reference "now" so every case is deterministic regardless of wall clock.
// 固定的参考「现在」，让每个用例与真实时钟无关、完全确定。
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const LOCALE = "en";

/** Independently expected phrase for (amount, unit) — robust to ICU wording. */
/** 对 (amount, unit) 独立构造的期望短语——对 ICU 措辞变化鲁棒。 */
function expected(amount: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" }).format(
    amount,
    unit,
  );
}

function ago(seconds: number): string {
  const parts = relativeTimeFromNow(NOW - seconds * 1000, {
    now: NOW,
    locale: LOCALE,
  });
  if (!parts) throw new Error("expected a result");
  return parts.relative;
}

describe("relativeTimeFromNow — best-fit ladder", () => {
  // Each row: seconds-in-the-past → the (amount, unit) the ladder must pick.
  // 每行：过去多少秒 → 阶梯必须选中的 (amount, unit)。
  const cases: ReadonlyArray<
    [
      label: string,
      seconds: number,
      amount: number,
      unit: Intl.RelativeTimeFormatUnit,
    ]
  > = [
    ["10s collapses to now", 10, 0, "second"],
    ["5 minutes", 5 * 60, -5, "minute"],
    ["3 hours", 3 * 3600, -3, "hour"],
    ["2 days", 2 * 86400, -2, "day"],
    ["3 weeks", 3 * 604800, -3, "week"],
  ];

  for (const [label, seconds, amount, unit] of cases) {
    test(label, () => {
      expect(ago(seconds)).toBe(expected(amount, unit));
    });
  }

  test("future timestamps read as 'in …'", () => {
    const parts = relativeTimeFromNow(NOW + 5 * 60 * 1000, {
      now: NOW,
      locale: LOCALE,
    });
    expect(parts?.relative).toBe(expected(5, "minute"));
  });
});

describe("relativeTimeFromNow — robustness", () => {
  test("returns null for an unparseable string", () => {
    expect(relativeTimeFromNow("not-a-date", { now: NOW })).toBeNull();
  });

  test("returns null for NaN/invalid Date", () => {
    expect(relativeTimeFromNow(new Date("nope"), { now: NOW })).toBeNull();
  });

  test("accepts Date, ISO string, and epoch ms identically", () => {
    const iso = new Date(NOW - 3600 * 1000).toISOString();
    const fromIso = relativeTimeFromNow(iso, {
      now: NOW,
      locale: LOCALE,
    })?.relative;
    const fromDate = relativeTimeFromNow(new Date(iso), {
      now: NOW,
      locale: LOCALE,
    })?.relative;
    const fromMs = relativeTimeFromNow(NOW - 3600 * 1000, {
      now: NOW,
      locale: LOCALE,
    })?.relative;
    expect(fromIso).toBe(expected(-1, "hour"));
    expect(fromDate).toBe(fromIso);
    expect(fromMs).toBe(fromIso);
  });

  test("exposes ISO dateTime and a localized absolute tooltip", () => {
    const parts = relativeTimeFromNow(NOW, { now: NOW, locale: LOCALE });
    expect(parts?.iso).toBe(new Date(NOW).toISOString());
    expect(parts?.absolute).toBe(
      new Intl.DateTimeFormat(LOCALE, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(NOW)),
    );
  });
});
