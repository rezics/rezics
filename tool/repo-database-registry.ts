export function renderCreateDatabaseSql(databaseNames: readonly string[]) {
  return `${databaseNames
    .map(
      (databaseName) => `SELECT 'CREATE DATABASE ${databaseName}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${databaseName}')\\gexec`,
    )
    .join("\n\n")}\n`;
}
