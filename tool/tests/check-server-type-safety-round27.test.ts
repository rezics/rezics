import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const serverSrc = join(import.meta.dir, "../../package/server/src");

describe("server type safety (round 27)", () => {
  test("progress.service.ts has no as unknown as", () => {
    const src = readFileSync(
      join(serverSrc, "progress/progress.service.ts"),
      "utf-8",
    );
    expect(src).not.toContain("as unknown as");
  });

  test("federatedSingle switch has exhaustive default guard", () => {
    const src = readFileSync(
      join(serverSrc, "meili/search/federated.service.ts"),
      "utf-8",
    );
    expect(src).toContain("const _exhaustive: never = category");
  });
});
