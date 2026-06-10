import { describe, expect, test } from "bun:test";
import { STYLE_PROPERTIES, truncate } from "../browser-inspect/src";

const REPO_ROOT = `${import.meta.dir}/../..`;

async function checkIgnored(path: string) {
  const proc = Bun.spawn(["git", "check-ignore", path], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}

describe("browser inspect workbench helpers", () => {
  test("scratch scripts and persistent browser profile are ignored", async () => {
    expect(
      await checkIgnored("tool/browser-inspect/work/current.ts"),
    ).toMatchObject({
      exitCode: 0,
      stdout: "tool/browser-inspect/work/current.ts\n",
    });
    expect(
      await checkIgnored("tool/browser-inspect/profile/Default/Cookies"),
    ).toMatchObject({
      exitCode: 0,
      stdout: "tool/browser-inspect/profile/Default/Cookies\n",
    });
  });

  test("style snapshots include layout and typography properties", () => {
    expect(STYLE_PROPERTIES).toContain("display");
    expect(STYLE_PROPERTIES).toContain("position");
    expect(STYLE_PROPERTIES).toContain("fontFamily");
    expect(STYLE_PROPERTIES).toContain("fontSize");
    expect(STYLE_PROPERTIES).toContain("lineHeight");
    expect(STYLE_PROPERTIES).toContain("color");
    expect(STYLE_PROPERTIES).toContain("backgroundColor");
    expect(STYLE_PROPERTIES).toContain("paddingTop");
    expect(STYLE_PROPERTIES).toContain("marginTop");
    expect(STYLE_PROPERTIES).toContain("borderTopWidth");
  });

  test("locator summaries truncate long text for terminal output", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("abc", 4)).toBe("abc");
  });
});
