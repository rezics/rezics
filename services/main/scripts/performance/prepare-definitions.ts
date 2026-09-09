import { initializeObservability } from "@rezics/observability";
import { fixtureId } from "./config";

const target = new URL(process.env.DATABASE_URL ?? "postgres://invalid/invalid");
if (
	target.pathname !== "/rezics_performance" ||
	!["127.0.0.1", "localhost"].includes(target.hostname)
)
	throw new Error("Definition preparation requires the disposable performance target");
const observability = initializeObservability({
	service: { name: "rezics-performance-definitions", version: "1", environment: "tooling" },
});
const { database } = await import("../../src/services/database");
try {
	const { ensureSimpleTagExpressionInTransaction } = await import(
		"../../src/services/tag-expressions/service"
	);
	for (let ordinal = 0; ordinal < 100; ordinal++)
		await database.transaction((tx) =>
			ensureSimpleTagExpressionInTransaction(tx, { tagId: fixtureId(4, ordinal) }),
		);
} finally {
	await database.$client.end();
	await observability.shutdown();
}
