import { describe, expect, test } from "bun:test";
import MarkdownIt from "markdown-it";
import { novelModePlugin } from "./preserveFormatting";
import { sourceLinePlugin } from "./sourceLine";

describe("sourceLinePlugin", () => {
  const md = new MarkdownIt({ html: true })
    .use(novelModePlugin)
    .use(sourceLinePlugin);

  test("injects data-source-line on block elements", () => {
    const sample = `# Heading 1

A paragraph here.

## Heading 2

- Item 1
- Item 2

> A blockquote

\`\`\`js
const x = 1;
\`\`\`

1. Ordered item
`;
    const result = md.render(sample);

    // Check key elements have data-source-line
    // 检查关键元素带有 data-source-line
    expect(result).toMatch(/<h1[^>]*data-source-line="\d+"/);
    expect(result).toMatch(/<h2[^>]*data-source-line="\d+"/);
    expect(result).toMatch(/<p[^>]*data-source-line="\d+"/);
    expect(result).toMatch(/<ul[^>]*data-source-line="\d+"/);
    expect(result).toMatch(/<ol[^>]*data-source-line="\d+"/);
    expect(result).toMatch(/<blockquote[^>]*data-source-line="\d+"/);

    // fence token - attr ends up on <code> inside <pre>
    // fence 令牌——属性最终落在 <pre> 内的 <code> 上
    expect(result).toMatch(/<code data-source-line="11"/);
  });

  test("composes with novelModePlugin without conflict", () => {
    const result = md.render(
      "Line one\n\n\n\nLine after gaps\n\n  double  spaces",
    );
    // novelModePlugin features should still work
    // novelModePlugin 的功能应当仍然有效
    expect(result).toContain("preserved-empty-lines");
    expect(result).toContain("&nbsp;");
    // source-line attrs should also be present
    // source-line 属性也应当存在
    expect(result).toMatch(/data-source-line/);
  });
});
