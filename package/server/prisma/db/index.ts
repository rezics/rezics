import {Client} from 'pg';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {sequence, keyOrder} from './sequence.js';
import {env} from '@/src/env';
import {fileURLToPath} from 'node:url';

const SQL_BASE_DIR = fileURLToPath(new URL('./sql', import.meta.url));

type PgClientConfig =
  | {connectionString: string}
  | {
      host?: string;
      port?: number;
      user?: string;
      password?: string;
      database?: string;
    };

function createPgClient(): Client {
  const config = {connectionString: env.DATABASE_URL};

  console.log('🔌 Creating PostgreSQL client...', config);

  return new Client(config);
}

async function runSqlFile(
  client: Client,
  group: string,
  name: string,
): Promise<void> {
  const filePath = join(SQL_BASE_DIR, group, `${name}.sql`);
  const sql = await readFile(filePath, 'utf8');

  console.log(`\n▶️  Running SQL: [${group}] ${name}`);
  await client.query(sql);
}

/**
 * Connect to PostgreSQL and execute SQL files in the order defined by `keyOrder` / `sequence`.
 *
 * The `.env` file should define either:
 * - DATABASE_URL
 *   or
 * - PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
 */
export async function runDbSequence(): Promise<void> {
  console.log('🔌 Running db migrate sequence...');

  const client = createPgClient();

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    for (const group of keyOrder) {
      const items = sequence[group as keyof typeof sequence] ?? [];

      for (const name of items) {
        await runSqlFile(client, group, name);
      }
    }

    console.log('\n🎉 All SQL files executed successfully.');
  } catch (err) {
    console.error('❌ Error while running DB sequence:', err);
    throw err;
  } finally {
    await client.end();
    console.log('🔌 PostgreSQL connection closed');
  }
}

runDbSequence().catch(err => {
  console.error('❌ Error while running DB sequence:', err);
  process.exitCode = 1;
});
