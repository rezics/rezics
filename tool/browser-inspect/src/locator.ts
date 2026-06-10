import type { Locator } from "playwright";

export type LocatorSummary = {
  index: number;
  text: string;
  html: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  visible: boolean;
};

export type LocatorSummaryOptions = {
  limit?: number;
  textLimit?: number;
  htmlLimit?: number;
};

export async function highlightLocator(
  locator: Locator,
  options: { color?: string; label?: string } = {},
) {
  const color = options.color ?? "#ff4d00";
  const label = options.label ?? "browser-inspect";

  await locator.evaluateAll(
    (elements, args) => {
      for (const [index, element] of elements.entries()) {
        if (!(element instanceof HTMLElement)) {
          continue;
        }

        element.style.outline = `3px solid ${args.color}`;
        element.style.outlineOffset = "2px";
        element.dataset.browserInspect = `${args.label}:${index}`;
      }
    },
    { color, label },
  );
}

export async function collectLocatorSummaries(
  locator: Locator,
  options: LocatorSummaryOptions = {},
): Promise<LocatorSummary[]> {
  const limit = options.limit ?? 5;
  const textLimit = options.textLimit ?? 500;
  const htmlLimit = options.htmlLimit ?? 1_500;
  const count = Math.min(await locator.count(), limit);
  const summaries: LocatorSummary[] = [];

  for (let index = 0; index < count; index += 1) {
    const current = locator.nth(index);
    const [text, html, boundingBox, visible] = await Promise.all([
      current.textContent(),
      current.evaluate((element) => element.outerHTML),
      current.boundingBox(),
      current.isVisible(),
    ]);

    summaries.push({
      index,
      text: truncate(text?.trim() ?? "", textLimit),
      html: truncate(html, htmlLimit),
      boundingBox,
      visible,
    });
  }

  return summaries;
}

export function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}
