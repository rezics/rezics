import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exec } from "./tools";

export interface CapturedQuery {
	caseId: string;
	text: string;
	values: unknown[];
}

function arrayParameter(values: unknown[]): string {
	return `{${values.map((value) => (value === null ? "NULL" : Array.isArray(value) ? arrayParameter(value) : `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`)).join(",")}}`;
}

/** Encode bind values, never interpolate them into the captured SQL text. */
export function parameterLiteral(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	const text = Array.isArray(value)
		? arrayParameter(value)
		: typeof value === "object"
			? JSON.stringify(value)
			: String(value);
	return `E'${text.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

/** SQL-only comparison uses the captured queries, with explicit preparation cost included. */
export async function runSqlLoad(
	container: string,
	output: string,
	queries: readonly CapturedQuery[],
) {
	const directory = resolve(output, "pgbench-input");
	await mkdir(directory);
	const groups = new Map<string, CapturedQuery[]>();
	for (const query of queries) {
		const group = groups.get(query.caseId) ?? [];
		group.push(query);
		groups.set(query.caseId, group);
	}
	const files: string[] = [];
	let groupIndex = 0;
	for (const group of groups.values()) {
		const filename = `query-${groupIndex++}.sql`;
		const statements = group.map(
			(query, index) =>
				`BEGIN READ ONLY;\nSET LOCAL statement_timeout='10s';\nPREPARE perf_${index} AS ${query.text.replace(/;\s*$/, "")};\nEXECUTE perf_${index}${query.values.length ? `(${query.values.map(parameterLiteral).join(",")})` : ""};\nDEALLOCATE perf_${index};\nCOMMIT;`,
		);
		await writeFile(resolve(directory, filename), `${statements.join("\n")}\n`);
		files.push(`/tmp/rezics-pgbench/${filename}`);
	}
	await exec("docker", ["exec", container, "mkdir", "-p", "/tmp/rezics-pgbench"], {
		windowsHide: true,
	});
	await exec("docker", ["cp", `${directory}/.`, `${container}:/tmp/rezics-pgbench/`], {
		windowsHide: true,
	});
	let log: string;
	try {
		const result = await exec(
			"docker",
			[
				"exec",
				container,
				"pgbench",
				"--no-vacuum",
				"--client=4",
				"--jobs=2",
				"--time=10",
				"--username=rezics_perf_reader",
				"--dbname=rezics_performance",
				...files.flatMap((file) => ["--file", file]),
			],
			{ windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
		);
		log = result.stdout + result.stderr;
	} catch (error) {
		const nativeLog =
			error && typeof error === "object"
				? [Reflect.get(error, "stdout"), Reflect.get(error, "stderr")]
						.filter((value) => typeof value === "string")
						.join("")
				: String(error);
		await writeFile(resolve(output, "pgbench.log"), nativeLog);
		throw error;
	}
	await writeFile(resolve(output, "pgbench.log"), log);
	const failed = /number of failed transactions:\s*(\d+)/i.exec(log)?.[1];
	if (failed === undefined || Number(failed) !== 0 || /\bERROR:/i.test(log))
		throw new Error("SQL load did not complete without failed transactions; see pgbench.log");
	return {
		caseFiles: files.length,
		durationSeconds: 10,
		clients: 4,
		failedTransactions: Number(failed),
		scope:
			"SQL-only mixed workload, includes preparation and per-query transactions, after API load",
		statementTimeoutMs: 10_000,
		transactionScope: "one-per-query",
	};
}
