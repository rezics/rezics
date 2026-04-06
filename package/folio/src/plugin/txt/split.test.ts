import { describe, expect, it } from "bun:test";
import { splitTxt } from "./split";

describe("splitTxt", () => {
  it("splits by CJK chapter markers", () => {
    const raw = `第一章 开始
这是第一章的内容

第二章 发展
这是第二章的内容

第三章 结局
这是第三章的内容`;

    const result = splitTxt(raw);
    expect(result.tree).toHaveLength(3);
    expect(result.tree[0].title).toBe("第一章 开始");
    expect(result.tree[1].title).toBe("第二章 发展");
    expect(result.tree[2].title).toBe("第三章 结局");
    expect(result.ruleUsed).toBeTruthy();
  });

  it("splits by English chapter markers", () => {
    const raw = `Chapter 1
First chapter content.

Chapter 2
Second chapter content.`;

    const result = splitTxt(raw);
    expect(result.tree).toHaveLength(2);
    expect(result.tree[0].title).toBe("Chapter 1");
    expect(result.tree[1].title).toBe("Chapter 2");
  });

  it("splits by markdown headings", () => {
    const raw = `# Introduction
Intro text.

## Getting Started
Getting started text.

## Advanced
Advanced text.`;

    const result = splitTxt(raw);
    expect(result.tree).toHaveLength(3);
    expect(result.tree[0].title).toBe("# Introduction");
  });

  it("uses custom split rules", () => {
    const raw = `Part One
Content A.

Part Two
Content B.

Part Three
Content C.`;

    const result = splitTxt(raw, {
      splitRules: [/^Part\s+\w+/im],
    });
    expect(result.tree).toHaveLength(3);
    expect(result.tree[0].title).toBe("Part One");
  });

  it("falls back to single chapter when no rule matches", () => {
    const raw = "Just a plain text file with no chapter markers.";

    const result = splitTxt(raw);
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0].title).toBe("Full Text");
    expect(result.ruleUsed).toBeNull();
  });

  it("handles empty input", () => {
    const result = splitTxt("");
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0].title).toBe("Full Text");
    expect(result.ruleUsed).toBeNull();
  });

  it("returns synchronous fetch on each node", async () => {
    const raw = `Chapter 1
Hello

Chapter 2
World`;

    const result = splitTxt(raw);
    const content = await result.tree[0].fetch!(new AbortController().signal);
    expect(content.contentType).toBe("txt");
    expect(content.raw).toContain("Hello");
  });

  it("preserves content before first marker as preface", () => {
    const raw = `Some introduction text

Chapter 1
First chapter

Chapter 2
Second chapter`;

    const result = splitTxt(raw);
    expect(result.tree).toHaveLength(3);
    expect(result.tree[0].title).toBe("Preface");
  });

  it("tries rules in order, uses first that matches >= 2", () => {
    // Text has both CJK and English markers — CJK should win (comes first in default rules)
    const raw = `第一章 开头
内容A

第二章 结尾
内容B

Chapter 1
English content`;

    const result = splitTxt(raw);
    expect(result.tree[0].title).toBe("第一章 开头");
  });
});
