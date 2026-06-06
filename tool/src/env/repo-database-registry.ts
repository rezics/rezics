export function renderCreateDatabaseSql(databaseNames: readonly string[]) {
  return `${databaseNames
    .map(
      (databaseName) => `SELECT 'CREATE DATABASE ${databaseName}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${databaseName}')\\gexec`,
    )
    .join("\n\n")}\n`;
}

function quotePgIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function quotePgLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function renderResetDatabaseSql(databaseNames: readonly string[]) {
  return `${databaseNames
    .map((databaseName) =>
      [
        "SELECT pg_terminate_backend(pid)",
        "FROM pg_stat_activity",
        `WHERE datname = ${quotePgLiteral(databaseName)} AND pid <> pg_backend_pid();`,
        `DROP DATABASE IF EXISTS ${quotePgIdentifier(databaseName)};`,
        `CREATE DATABASE ${quotePgIdentifier(databaseName)};`,
      ].join("\n"),
    )
    .join("\n\n")}\n`;
}
