import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

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
    ]) {
      const source = readDockerfile(service);
      expect(source).not.toContain("bunx prisma generate");
      expect(source).not.toContain("generated Prisma client");
      expect(source).not.toContain("Prisma 7");
    }
  });

  test("server Prisma generation is isolated to services still blocked by runtime search/server cutover", () => {
    expect(readDockerfile("server")).toContain("bunx prisma generate");
    expect(readDockerfile("job-runner")).toContain("bunx prisma generate");
    expect(readDockerfile("job-runner")).toContain(
      "until `@rezics/search` finishes its Drizzle cutover",
    );
  });
});
