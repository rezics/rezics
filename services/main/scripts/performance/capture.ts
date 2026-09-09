import { appendFileSync, readFileSync } from "node:fs";
import pg from "pg";

// Diagnostic preload only. Every query still executes through the original pg
// implementation; the uninstrumented process is used for the k6 measurement.
const destination = process.env.REZICS_PERF_CAPTURE;
const caseFile = process.env.REZICS_PERF_CASE_FILE;
const url = new URL(process.env.DATABASE_URL ?? "postgres://invalid/invalid");
if (
	!destination ||
	!caseFile ||
	url.pathname !== "/rezics_performance" ||
	!["127.0.0.1", "localhost"].includes(url.hostname)
)
	throw new Error("SQL capture requires the isolated performance database");

pg.Client.prototype.query = new Proxy(pg.Client.prototype.query, {
	apply(target, receiver, argumentsList) {
		const input: unknown = argumentsList[0];
		const config = input && typeof input === "object" ? input : undefined;
		const text =
			typeof input === "string" ? input : config && "text" in config ? config.text : undefined;
		const values =
			config && "values" in config
				? config.values
				: Array.isArray(argumentsList[1])
					? argumentsList[1]
					: [];
		if (typeof text === "string" && /^\s*(select|with)\b/i.test(text)) {
			const caseId = readFileSync(caseFile, "utf8").trim();
			if (caseId)
				appendFileSync(
					destination,
					`${JSON.stringify({ caseId, text, values }, (_key, value) => (typeof value === "bigint" ? value.toString() : value))}\n`,
				);
		}
		return Reflect.apply(target, receiver, argumentsList);
	},
});
