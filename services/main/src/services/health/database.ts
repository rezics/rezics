import { sql } from "drizzle-orm";

import { database } from "../database";

export async function checkDatabase(signal: AbortSignal): Promise<boolean> {
	if (signal.aborted) return false;
	await database.execute(sql`select 1`);
	return !signal.aborted;
}
