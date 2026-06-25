import { render as reactEmailRender } from "@react-email/components";
import { type ComponentType, createElement } from "react";

export async function render<P extends Record<string, unknown>>(
  template: ComponentType<P>,
  props: P,
): Promise<{ html: string; text: string }> {
  const element = createElement(template, props);

  const [html, text] = await Promise.all([
    reactEmailRender(element),
    reactEmailRender(element, { plainText: true }),
  ]);

  return { html, text };
}
