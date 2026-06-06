import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TextLink } from "./TextLink";

describe("TextLink", () => {
  test("uses the link color role by default", () => {
    const html = renderToStaticMarkup(
      <TextLink href="/book" underline="hover">
        Browse
      </TextLink>,
    );

    expect(html).toContain("text-link");
    expect(html).toContain("hover:underline");
    expect(html).not.toContain("text-brand");
    expect(html).not.toContain("hover:opacity-80");
  });
});
