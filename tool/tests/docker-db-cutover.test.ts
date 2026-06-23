import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");

function readDockerfile(name: string): string {
  return readFileSync(join(repoRoot, "docker", `${name}.Dockerfile`), "utf8");
}

const dockerDir = join(repoRoot, "docker");

describe("Docker database cutover", () => {
  // Skip if docker/ directory doesn't exist yet
  // docker/ ディレクトリが存在しない場合はスキップ
  test.skipIf(!existsSync(dockerDir))(
    "Drizzle-cutover service images do not generate Prisma clients",
    () => {
      for (const service of [
        "auth",
        "notify",
        "reaction",
        "history",
        "ranking",
        "server",
        "job-runner",
      ]) {
        const path = join(dockerDir, `${service}.Dockerfile`);
        if (!existsSync(path)) continue;
        const source = readDockerfile(service);
        expect(source).not.toContain("bunx prisma generate");
        expect(source).not.toContain("generated Prisma client");
        expect(source).not.toContain("Prisma 7");
      }
    },
  );
});
