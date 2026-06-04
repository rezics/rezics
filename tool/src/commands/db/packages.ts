export const DB_SCHEMA_PACKAGES = [
  "auth",
  "server",
  "notify",
  "reaction",
  "history",
  "ranking",
] as const;

export const DB_MIGRATION_ORDER = [
  "auth",
  "server",
  "notify",
  "reaction",
  "history",
  "ranking",
] as const satisfies readonly DbSchemaPackage[];

export const DB_ENSURE_ONLY_PACKAGES = ["job-runner"] as const;

export type DbSchemaPackage = (typeof DB_SCHEMA_PACKAGES)[number];
export type DbEnsureOnlyPackage = (typeof DB_ENSURE_ONLY_PACKAGES)[number];
export type DbPackage = DbSchemaPackage | DbEnsureOnlyPackage;

export function isDbSchemaPackage(value: string): value is DbSchemaPackage {
  return DB_SCHEMA_PACKAGES.includes(value as DbSchemaPackage);
}

export function isDbPackage(value: string): value is DbPackage {
  return (
    isDbSchemaPackage(value) ||
    DB_ENSURE_ONLY_PACKAGES.includes(value as DbEnsureOnlyPackage)
  );
}

export function resolveDbSchemaPackages(selection: readonly string[]): {
  packages: DbSchemaPackage[];
  unknown: string[];
  ensureOnly: DbEnsureOnlyPackage[];
} {
  if (selection.length === 0 || selection.includes("all")) {
    return { packages: [...DB_MIGRATION_ORDER], unknown: [], ensureOnly: [] };
  }

  const picked = new Set<DbSchemaPackage>();
  const unknown: string[] = [];
  const ensureOnly: DbEnsureOnlyPackage[] = [];

  for (const value of selection) {
    if (isDbSchemaPackage(value)) {
      picked.add(value);
    } else if (DB_ENSURE_ONLY_PACKAGES.includes(value as DbEnsureOnlyPackage)) {
      ensureOnly.push(value as DbEnsureOnlyPackage);
    } else {
      unknown.push(value);
    }
  }

  return {
    packages: DB_MIGRATION_ORDER.filter((pkg) => picked.has(pkg)),
    unknown,
    ensureOnly: Array.from(new Set(ensureOnly)),
  };
}
