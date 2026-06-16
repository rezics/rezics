import type { Locator } from "playwright";

export const STYLE_PROPERTIES = [
  "display",
  "visibility",
  "opacity",
  "position",
  "zIndex",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "color",
  "backgroundColor",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
] as const;

export type StyleProperty = (typeof STYLE_PROPERTIES)[number];

export type ElementStyleSnapshot = {
  text: string;
  html: string;
  boundingBox: DOMRectSnapshot;
  styles: Record<StyleProperty, string>;
};

export type DOMRectSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function normalizeRect(rect: DOMRect): DOMRectSnapshot {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}

export async function dumpElementStyle(
  locator: Locator,
): Promise<ElementStyleSnapshot> {
  return locator.first().evaluate((element, properties) => {
    const computed = getComputedStyle(element);
    const styles = Object.fromEntries(
      properties.map((property) => [
        property,
        computed[property as keyof CSSStyleDeclaration],
      ]),
    ) as Record<(typeof properties)[number], string>;

    return {
      text: element.textContent?.trim() ?? "",
      html: element.outerHTML,
      boundingBox: {
        x: element.getBoundingClientRect().x,
        y: element.getBoundingClientRect().y,
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        top: element.getBoundingClientRect().top,
        right: element.getBoundingClientRect().right,
        bottom: element.getBoundingClientRect().bottom,
        left: element.getBoundingClientRect().left,
      },
      styles,
    };
  }, STYLE_PROPERTIES);
}
