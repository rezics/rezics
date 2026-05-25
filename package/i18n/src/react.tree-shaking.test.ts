import { describe, expect, test } from "bun:test";

describe("useMessage bundle shape", () => {
  test("tree-shakes unused generated messages from a one-message fixture", async () => {
    const result = await Bun.build({
      entrypoints: [
        new URL("./__fixtures__/tree-shake-use-message.ts", import.meta.url)
          .pathname,
      ],
      external: ["react"],
      format: "esm",
      minify: true,
      target: "browser",
      write: false,
    });

    expect(result.success).toBe(true);
    expect(result.outputs).toHaveLength(1);

    const bundle = await result.outputs[0].text();

    expect(bundle).toContain("Save");
    expect(bundle).not.toContain("app_help_feedback");
    expect(bundle).not.toContain("Feedback");
    expect(bundle).not.toContain("realm_tag_tree");
    expect(bundle).not.toContain("Tag tree");
  });
});
