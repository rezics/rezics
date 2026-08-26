type UnknownRecord = Readonly<Record<string, unknown>>;

export type PostgreSqlExplainPlan = readonly [
	Readonly<{
		readonly "Execution Time": number;
		readonly "Planning Time": number;
		readonly Plan: UnknownRecord;
	}>,
];

export type PlanSummary = Readonly<{
	readonly indexNames: readonly string[];
	readonly nodeTypes: readonly string[];
	readonly sequentialScanRelations: readonly string[];
	readonly sorts: readonly Readonly<{
		readonly actualRows: number;
		readonly method: string | null;
	}>[];
	readonly sharedHitBlocks: number;
	readonly sharedReadBlocks: number;
	readonly sharedWrittenBlocks: number;
}>;

export type LatencySummary = Readonly<{
	readonly count: number;
	readonly maximumMilliseconds: number;
	readonly p50Milliseconds: number;
	readonly p95Milliseconds: number;
	readonly p99Milliseconds: number;
}>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireFiniteNumber(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isFinite(value))
		throw new TypeError(field + " must be a finite number");
	return value;
}

export function decodePostgreSqlExplainPlan(value: unknown): PostgreSqlExplainPlan {
	if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0]))
		throw new TypeError("PostgreSQL EXPLAIN JSON must contain exactly one root document");
	const document = value[0];
	if (!isRecord(document.Plan)) throw new TypeError("PostgreSQL EXPLAIN JSON has no root Plan");
	return [
		{
			"Execution Time": requireFiniteNumber(document["Execution Time"], "Execution Time"),
			"Planning Time": requireFiniteNumber(document["Planning Time"], "Planning Time"),
			Plan: document.Plan,
		},
	];
}

function optionalPlanNumber(node: UnknownRecord, field: string): number {
	const value = node[field];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function summarizePostgreSqlPlan(plan: UnknownRecord): PlanSummary {
	const indexNames = new Set<string>();
	const nodeTypes = new Set<string>();
	const sequentialScanRelations = new Set<string>();
	const sorts: { actualRows: number; method: string | null }[] = [];
	const visit = (node: UnknownRecord): void => {
		const nodeType = node["Node Type"];
		if (typeof nodeType === "string") {
			nodeTypes.add(nodeType);
			if (nodeType === "Seq Scan" && typeof node["Relation Name"] === "string")
				sequentialScanRelations.add(node["Relation Name"]);
			if (nodeType === "Sort")
				sorts.push({
					actualRows: optionalPlanNumber(node, "Actual Rows"),
					method: typeof node["Sort Method"] === "string" ? node["Sort Method"] : null,
				});
		}
		if (typeof node["Index Name"] === "string") indexNames.add(node["Index Name"]);
		if (Array.isArray(node.Plans))
			for (const child of node.Plans) if (isRecord(child)) visit(child);
	};
	visit(plan);
	return {
		indexNames: [...indexNames].sort(),
		nodeTypes: [...nodeTypes].sort(),
		sequentialScanRelations: [...sequentialScanRelations].sort(),
		sorts,
		// Root counters include child work. Summing nodes would double-count it.
		sharedHitBlocks: optionalPlanNumber(plan, "Shared Hit Blocks"),
		sharedReadBlocks: optionalPlanNumber(plan, "Shared Read Blocks"),
		sharedWrittenBlocks: optionalPlanNumber(plan, "Shared Written Blocks"),
	};
}

export function assertBoundedPostgreSqlPlan(input: {
	readonly name: string;
	readonly plan: PostgreSqlExplainPlan;
	readonly requiredIndexes: readonly string[];
	readonly requiredIndexAlternatives?: readonly (readonly string[])[];
	readonly corpusRelations: readonly string[];
	readonly maximumSharedBlocks: number;
	readonly maximumTopNSortRows?: number;
}): PlanSummary {
	const summary = summarizePostgreSqlPlan(input.plan[0].Plan);
	for (const indexName of input.requiredIndexes)
		if (!summary.indexNames.includes(indexName))
			throw new Error(input.name + " did not use required routing index " + indexName);
	for (const alternatives of input.requiredIndexAlternatives ?? []) {
		if (alternatives.length === 0)
			throw new Error(input.name + " declared an empty routing-index alternative group");
		if (!alternatives.some((indexName) => summary.indexNames.includes(indexName)))
			throw new Error(
				input.name + " did not use any accepted routing index: " + alternatives.join(", "),
			);
	}
	const forbiddenSequentialScans = summary.sequentialScanRelations.filter((relation) =>
		input.corpusRelations.includes(relation),
	);
	if (forbiddenSequentialScans.length)
		throw new Error(
			input.name +
				" sequentially scanned corpus relation(s): " +
				forbiddenSequentialScans.join(", "),
		);
	const maximumTopNSortRows = input.maximumTopNSortRows ?? 0;
	for (const sort of summary.sorts)
		if (sort.method !== "top-N heapsort" || sort.actualRows > maximumTopNSortRows)
			throw new Error(input.name + " used an unbounded sort (" + (sort.method ?? "unknown") + ")");
	const touchedBlocks = summary.sharedHitBlocks + summary.sharedReadBlocks;
	if (touchedBlocks > input.maximumSharedBlocks)
		throw new Error(
			input.name +
				" touched " +
				touchedBlocks +
				" shared blocks; maximum is " +
				input.maximumSharedBlocks,
		);
	return summary;
}

export function requireDisposableTagPathDatabase(input: {
	readonly confirmation: boolean;
	readonly connectionString: string | undefined;
	readonly marker: string | undefined;
}): string {
	if (!input.confirmation)
		throw new Error("Tag Path capacity work requires explicit --yes confirmation");
	if (input.marker !== "tag-path-capacity-v1")
		throw new Error(
			"TAG_PATH_CAPACITY_DISPOSABLE=tag-path-capacity-v1 is required for destructive capacity work",
		);
	if (!input.connectionString) throw new Error("DATABASE_ADMIN_URL is required");
	const target = new URL(input.connectionString);
	if (!["postgres:", "postgresql:"].includes(target.protocol))
		throw new Error("Tag Path capacity work requires a PostgreSQL URL");
	if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))
		throw new Error("Tag Path capacity work is restricted to a loopback PostgreSQL authority");
	if (decodeURIComponent(target.pathname.slice(1)) !== "rezics_atlas")
		throw new Error("Tag Path capacity work may run only against disposable rezics_atlas");
	return input.connectionString;
}

export function readPositiveIntegerFlag(
	argv: readonly string[],
	name: string,
	fallback: number,
	maximum: number,
): number {
	const position = argv.indexOf(name);
	if (position < 0) return fallback;
	const value = Number(argv[position + 1]);
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
		throw new RangeError(name + " must be an integer between 1 and " + maximum);
	return value;
}

export function percentile(sortedValues: readonly number[], fraction: number): number {
	if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1)
		throw new RangeError("Percentile fraction must be in the range [0, 1]");
	if (!sortedValues.length) return 0;
	const index = Math.max(0, Math.ceil(sortedValues.length * fraction) - 1);
	return Number((sortedValues[index] ?? 0).toFixed(3));
}

export function summarizeLatencies(values: readonly number[]): LatencySummary {
	const sorted = [...values].sort((left, right) => left - right);
	return {
		count: sorted.length,
		maximumMilliseconds: Number((sorted.at(-1) ?? 0).toFixed(3)),
		p50Milliseconds: percentile(sorted, 0.5),
		p95Milliseconds: percentile(sorted, 0.95),
		p99Milliseconds: percentile(sorted, 0.99),
	};
}

export function hasPostgreSqlErrorCode(error: unknown, code: string): boolean {
	return isRecord(error) && error.code === code;
}
