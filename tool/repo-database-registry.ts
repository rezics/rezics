export const REPO_DATABASES = [
  {
    key: "server",
    packageName: "server",
    envVar: "DATABASE_URL",
    databaseName: "rezics_server",
  },
  {
    key: "auth",
    packageName: "auth",
    envVar: "AUTH_DATABASE_URL",
    databaseName: "rezics_auth",
  },
  {
    key: "job",
    packageName: "job-runner",
    envVar: "JOB_DATABASE_URL",
    databaseName: "rezics_jobs",
  },
  {
    key: "history",
    packageName: "history",
    envVar: "HISTORY_DATABASE_URL",
    databaseName: "rezics_history",
  },
  {
    key: "notify",
    packageName: "notify",
    envVar: "NOTIFY_DATABASE_URL",
    databaseName: "rezics_notify",
  },
  {
    key: "reaction",
    packageName: "reaction",
    envVar: "REACTION_DATABASE_URL",
    databaseName: "rezics_reaction",
  },
  {
    key: "ranking",
    packageName: "ranking",
    envVar: "RANKING_DATABASE_URL",
    databaseName: "rezics_ranking",
  },
] as const;

export type RepoDatabase = (typeof REPO_DATABASES)[number];
export type RepoDatabaseKey = RepoDatabase["key"];

export function repoDatabaseNames() {
  return REPO_DATABASES.map((database) => database.databaseName);
}

export function renderCreateDatabaseSql() {
  return `${REPO_DATABASES.map(
    (database) => `SELECT 'CREATE DATABASE ${database.databaseName}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${database.databaseName}')\\gexec`,
  ).join("\n\n")}\n`;
}
