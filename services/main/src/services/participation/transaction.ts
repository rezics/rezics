import { database, type DatabaseTransaction } from "../database";

function retryableTransactionFailure(cause: unknown, depth = 0): boolean {
	if (depth > 4 || typeof cause !== "object" || cause === null) return false;
	if ("code" in cause && (cause.code === "40001" || cause.code === "40P01")) return true;
	return "cause" in cause && retryableTransactionFailure(cause.cause, depth + 1);
}

/** Retries only fully rolled-back PostgreSQL serialization/deadlock failures; work must contain database effects only. @internal */
export async function runParticipationTransaction<T>(
	work: (tx: DatabaseTransaction) => Promise<T>,
	options?: { isolationLevel: "read committed" | "repeatable read" | "serializable" },
): Promise<T> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await database.transaction(work, options);
		} catch (cause) {
			if (attempt >= 2 || !retryableTransactionFailure(cause)) throw cause;
			await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
		}
	}
}
