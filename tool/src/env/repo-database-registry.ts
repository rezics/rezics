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

function renderDropReplicationSlotsSql(databaseName: string): string {
  const databaseLiteral = quotePgLiteral(databaseName);

  return `DO $$
DECLARE
  slot record;
  remaining_attempts integer;
BEGIN
  FOR slot IN
    SELECT slot_name, active_pid
    FROM pg_replication_slots
    WHERE database = ${databaseLiteral}
  LOOP
    IF slot.active_pid IS NOT NULL THEN
      PERFORM pg_terminate_backend(slot.active_pid);
      remaining_attempts := 50;
      WHILE EXISTS (
        SELECT 1
        FROM pg_replication_slots
        WHERE slot_name = slot.slot_name AND active
      ) AND remaining_attempts > 0 LOOP
        PERFORM pg_sleep(0.1);
        remaining_attempts := remaining_attempts - 1;
      END LOOP;
    END IF;

    PERFORM pg_drop_replication_slot(slot.slot_name);
  END LOOP;
END $$;`;
}

export function renderResetDatabaseSql(databaseNames: readonly string[]) {
  return `${databaseNames
    .map((databaseName) =>
      [
        "SELECT pg_terminate_backend(pid)",
        "FROM pg_stat_activity",
        `WHERE datname = ${quotePgLiteral(databaseName)} AND pid <> pg_backend_pid();`,
        renderDropReplicationSlotsSql(databaseName),
        `DROP DATABASE IF EXISTS ${quotePgIdentifier(databaseName)};`,
        `CREATE DATABASE ${quotePgIdentifier(databaseName)};`,
      ].join("\n"),
    )
    .join("\n\n")}\n`;
}
