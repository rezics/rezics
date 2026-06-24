import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("auth Better Auth database adapter", () => {
  test("uses the Drizzle adapter with auth schema mapping and database-generated IDs", () => {
    const instanceSource = readFileSync(
      join(import.meta.dir, "instance.ts"),
      "utf8",
    );
    const schemaSource = readFileSync(
      join(import.meta.dir, "../db/schema/auth.ts"),
      "utf8",
    );

    expect(instanceSource).toContain(
      'import { drizzleAdapter } from "@better-auth/drizzle-adapter";',
    );
    expect(instanceSource).not.toContain("@better-auth/prisma-adapter");
    expect(instanceSource).toContain("database: drizzleAdapter(db, {");
    expect(instanceSource).toContain("schema: betterAuthSchema");
    expect(instanceSource).toContain("generateId: false");
    expect(schemaSource).toContain("export const betterAuthSchema = {");
    for (const mappedModelName of [
      "user",
      "session",
      "account",
      "verification",
      "oauthClient",
      "oauthRefreshToken",
      "oauthAccessToken",
      "oauthConsent",
    ]) {
      expect(schemaSource).toContain(`${mappedModelName}:`);
    }
    expect(schemaSource).toContain("jwks,");
  });

  test("auth runtime source does not import Prisma", () => {
    const sourceFiles = [
      ...new Bun.Glob("**/*.ts").scanSync({
        cwd: join(import.meta.dir, ".."),
      }),
    ].filter((file) => !file.endsWith(".test.ts"));

    for (const file of sourceFiles) {
      const source = readFileSync(join(import.meta.dir, "..", file), "utf8");
      expect(source).not.toContain("@better-auth/prisma-adapter");
      expect(source).not.toContain("@prisma/client");
      expect(source).not.toContain("/prisma/");
    }
  });
});
