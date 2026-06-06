import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");

function readDockerfile(name: string): string {
  return readFileSync(join(repoRoot, "docker", `${name}.Dockerfile`), "utf8");
}

describe("Docker database cutover", () => {
  test("Drizzle-cutover service images do not generate Prisma clients", () => {
    for (const service of [
      "auth",
      "notify",
      "reaction",
      "history",
      "ranking",
      "server",
      "job-runner",
    ]) {
      const source = readDockerfile(service);
      expect(source).not.toContain("bunx prisma generate");
      expect(source).not.toContain("generated Prisma client");
      expect(source).not.toContain("Prisma 7");
    }
  });
});
