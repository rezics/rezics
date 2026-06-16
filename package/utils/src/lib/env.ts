import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createEnv } from "@t3-oss/env-core";
import { parse as parseDotenv } from "dotenv";
import * as v from "valibot";
import { getRepoRoot } from "./cache-dir";

type SeedEnv = {
  readonly AUTH_DATABASE_URL: string;
  readonly SERVER_DATABASE_URL: string;
  readonly MEILI_HOST: string;
  readonly MEILI_MASTER_KEY: string;
};

type EnvSource =
  | { kind: "process" }
  | { kind: "package"; pkg: string; sourceKey: string; file: string };

const PACKAGE_MAPPINGS = [
  { pkg: "auth", sourceKey: "DATABASE_URL", targetKey: "AUTH_DATABASE_URL" },
  {
    pkg: "server",
    sourceKey: "DATABASE_URL",
    targetKey: "SERVER_DATABASE_URL",
  },
  { pkg: "server", sourceKey: "MEILI_HOST", targetKey: "MEILI_HOST" },
  {
    pkg: "server",
    sourceKey: "MEILI_MASTER_KEY",
    targetKey: "MEILI_MASTER_KEY",
  },
] as const;

const sources = new Map<string, EnvSource>();

export class EnvValidationError extends Error {
  constructor(
    public readonly missing: readonly string[],
    public readonly attempts: readonly string[],
    public readonly examplePath: string | null,
    public readonly exampleContents: string | null,
  ) {
    super(`Missing environment variables: ${missing.join(", ")}`);
    this.name = "EnvValidationError";
  }
}

function loadFromWorkspacePackages(): string[] {
  const root = getRepoRoot();
  const attempts: string[] = [];

  for (const { pkg, sourceKey, targetKey } of PACKAGE_MAPPINGS) {
    if (process.env[targetKey]) {
      sources.set(targetKey, { kind: "process" });
      continue;
    }
    const file = join(root, "packages", pkg, ".env");
    if (!existsSync(file)) {
      attempts.push(`package/${pkg}/.env (file missing)`);
      continue;
    }
    const parsed = parseDotenv(readFileSync(file, "utf8"));
    const value = parsed[sourceKey];
    if (!value) {
      attempts.push(`package/${pkg}/.env (no ${sourceKey})`);
      continue;
    }
    process.env[targetKey] = value;
    sources.set(targetKey, { kind: "package", pkg, sourceKey, file });
  }

  return attempts;
}

function readExampleTemplate(): { path: string; contents: string } | null {
  const path = join(getRepoRoot(), "packages", "utils", ".env.example");
  if (!existsSync(path)) return null;
  return { path, contents: readFileSync(path, "utf8") };
}

let cached: SeedEnv | null = null;

export function getEnv(): SeedEnv {
  if (cached) return cached;
  const packageAttempts = loadFromWorkspacePackages();

  cached = createEnv({
    server: {
      AUTH_DATABASE_URL: v.string(),
      SERVER_DATABASE_URL: v.string(),
      MEILI_HOST: v.string(),
      MEILI_MASTER_KEY: v.string(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    onValidationError: (issues) => {
      const missing = Array.from(
        new Set(
          issues
            .map((i) => (Array.isArray(i.path) ? String(i.path[0]) : null))
            .filter((k): k is string => Boolean(k)),
        ),
      );
      const example = readExampleTemplate();
      throw new EnvValidationError(
        missing,
        packageAttempts,
        example?.path ?? null,
        example?.contents ?? null,
      );
    },
  }) as unknown as SeedEnv;
  return cached;
}

export function getEnvSource(key: keyof SeedEnv): EnvSource | undefined {
  return sources.get(key);
}
