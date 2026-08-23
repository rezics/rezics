import { toSafeInteger } from "../src/services/database/integer";

export function parseAggregateDriftCount(rows: readonly unknown[], checkName: string): number {
	if (rows.length !== 1)
		throw new Error(
			`${checkName} aggregate reconciliation must return exactly one result row; received ${rows.length}`,
		);
	const row = rows[0];
	if (
		row === null ||
		typeof row !== "object" ||
		!("drift_count" in row) ||
		typeof row.drift_count !== "string"
	)
		throw new Error(`${checkName} aggregate reconciliation returned a malformed drift count`);
	const driftCount = toSafeInteger(row.drift_count, `${checkName} aggregate drift count`);
	if (driftCount < 0)
		throw new Error(`${checkName} aggregate reconciliation returned a negative drift count`);
	return driftCount;
}
