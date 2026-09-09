import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
export const performanceRoot = resolve(repositoryRoot, "services/main/performance");
export const postgresImage = "rezics-postgres:18.6-pgroonga-4.0.8";
export const gmarkImage = "rezics-gmark:77be5b6";
export const gmarkRevision = "77be5b620375f2fabf1b14204d1d1f899d8f8425";
export const k6Version = "2.2.0";
export const planningScales = [500_000_000, 3_000_000_000] as const;

const configuration = z
	.object({
		mode: z.enum(["smoke", "load"]).default("smoke"),
		rows: z.coerce.number().int().min(1_000).max(100_000_000).default(1_000),
		seed: z.coerce.number().int().min(1).max(2_147_483_647).default(20260909),
		rate: z.coerce.number().int().min(1).max(10_000).default(10),
		durationSeconds: z.coerce.number().int().min(10).max(86_400).default(180),
		vus: z.coerce.number().int().min(1).max(10_000).default(32),
		journeyP95Ms: z.coerce.number().positive().default(2_000),
		journeyP99Ms: z.coerce.number().positive().default(5_000),
		keep: z.boolean().default(false),
		casePattern: z.string().max(200).default(""),
		cache: z.enum(["warm", "postgres-restart"]).default("warm"),
		jit: z.enum(["on", "off"]).default("on"),
		reuse: z
			.string()
			.regex(/^[a-f0-9]{16}$/)
			.optional(),
	})
	.strict();
export type Configuration = z.infer<typeof configuration>;

/** Parse bounded performance options without accepting an existing database target. */
export function parseOptions(args: readonly string[]): Configuration {
	const values: Record<string, unknown> = {};
	const names: Record<string, string> = {
		"--mode": "mode",
		"--rows": "rows",
		"--seed": "seed",
		"--rate": "rate",
		"--duration": "durationSeconds",
		"--vus": "vus",
		"--p95": "journeyP95Ms",
		"--p99": "journeyP99Ms",
		"--case": "casePattern",
		"--cache": "cache",
		"--jit": "jit",
		"--reuse": "reuse",
	};
	for (let index = 0; index < args.length; index++) {
		const argument = args[index]!;
		if (argument === "--keep") {
			values.keep = true;
			continue;
		}
		const key = names[argument];
		if (!key || args[index + 1] === undefined)
			throw new Error(`Unknown or incomplete option: ${argument}`);
		values[key] = args[++index];
	}
	return configuration.parse(values);
}

/** Stable, disjoint synthetic identities. They carry no source-provider meaning. */
export function fixtureId(family: number, ordinal: number): string {
	if (
		!Number.isSafeInteger(family) ||
		family < 1 ||
		family > 65535 ||
		!Number.isSafeInteger(ordinal) ||
		ordinal < 0 ||
		ordinal > 0xffffffffffff
	)
		throw new RangeError("Invalid synthetic identity");
	return `019f0000-${family.toString(16).padStart(4, "0")}-7000-8000-${ordinal.toString(16).padStart(12, "0")}`;
}

/** Cleanup is allowed only for the exact container created and labelled by this run. */
export function assertOwnedContainer(
	name: string,
	runId: string,
	labels: Record<string, string>,
): void {
	if (
		!/^rezics-perf-[a-f0-9]{16}$/.test(name) ||
		name !== `rezics-perf-${runId}` ||
		labels["org.rezics.performance.run"] !== runId
	)
		throw new Error("Refusing to remove a container outside this performance run");
}
