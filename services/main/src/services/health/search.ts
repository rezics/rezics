import { env } from "../config";
import { getActiveSearchGeneration } from "../search/generation";

/** Verify both the PostgreSQL generation pointer and the Meilisearch process. */
export async function checkSearch(signal: AbortSignal): Promise<boolean> {
	if (!env.MEILISEARCH_URL || !env.MEILISEARCH_QUERY_KEY) return false;
	await getActiveSearchGeneration("current");
	if (signal.aborted) return false;
	const response = await fetch(`${env.MEILISEARCH_URL}/health`, { signal });
	return response.ok && !signal.aborted;
}
