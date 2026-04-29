import { describe, expect, test } from "bun:test";
import { resolveEditorCommand } from "./editor";

describe("resolveEditorCommand", () => {
  test("$VISUAL wins over $EDITOR", () => {
    expect(
      resolveEditorCommand({ VISUAL: "code -w", EDITOR: "vim" }, "linux"),
    ).toBe("code -w");
  });

  test("$EDITOR is used when $VISUAL unset", () => {
    expect(resolveEditorCommand({ EDITOR: "nano" }, "linux")).toBe("nano");
  });

  test("trims whitespace and treats empty as unset", () => {
    expect(
      resolveEditorCommand({ VISUAL: "   ", EDITOR: "vim" }, "linux"),
    ).toBe("vim");
  });

  test("falls back to platform default on win32", () => {
    expect(resolveEditorCommand({}, "win32")).toBe("notepad");
  });

  test("falls back to platform default on linux", () => {
    expect(resolveEditorCommand({}, "linux")).toBe("vi");
  });

  test("falls back to platform default on darwin", () => {
    expect(resolveEditorCommand({}, "darwin")).toBe("vi");
  });
});
