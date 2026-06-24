import { describe, expect, test } from "bun:test";

// Test trigger detection logic in isolation
// 单独测试触发检测逻辑。
function matchMentionTrigger(
  lineText: string,
): { query: string; atPos: number } | null {
  const match = lineText.match(/(^|[\s\p{P}])@(\S*)$/u);
  if (!match) return null;
  const query = match[2];
  const atPos = lineText.length - query.length - 1;
  return { query, atPos };
}

describe("mention trigger detection", () => {
  test("triggers at start of line", () => {
    const result = matchMentionTrigger("@");
    expect(result).not.toBeNull();
    expect(result!.query).toBe("");
  });

  test("triggers after space", () => {
    const result = matchMentionTrigger("hello @john");
    expect(result).not.toBeNull();
    expect(result!.query).toBe("john");
  });

  test("does not trigger mid-word", () => {
    const result = matchMentionTrigger("email@example");
    expect(result).toBeNull();
  });

  test("extracts query correctly", () => {
    const result = matchMentionTrigger("hey @ali");
    expect(result).not.toBeNull();
    expect(result!.query).toBe("ali");
  });

  test("triggers after punctuation", () => {
    const result = matchMentionTrigger("hello,@bob");
    expect(result).not.toBeNull();
    expect(result!.query).toBe("bob");
  });
});
