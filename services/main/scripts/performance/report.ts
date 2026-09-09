import { z } from "zod";

const node = z
	.object({
		"Node Type": z.string(),
		"Plan Rows": z.number().optional(),
		"Actual Rows": z.number().optional(),
		"Actual Loops": z.number().optional(),
	})
	.passthrough();
const envelope = z
	.array(
		z
			.object({
				Plan: node,
				"Planning Time": z.number().optional(),
				"Execution Time": z.number().optional(),
			})
			.passthrough(),
	)
	.length(1);

/** EXPLAIN buffers are inclusive; report root counters rather than summing ancestors. */
export function summarizePlan(value: unknown) {
	const plan = envelope.parse(value)[0]!;
	const operators: {
		type: string;
		rows?: number;
		loops?: number;
		rowsAcrossLoops?: number;
		estimatedRows?: number;
		qError?: number;
		zeroMismatch?: boolean;
		removedRows: number;
		sortMethod?: string;
		sortSpaceType?: string;
		sortSpaceKb?: number;
	}[] = [];
	const visit = (value: unknown) => {
		const entry = node.parse(value);
		const rows = entry["Actual Rows"],
			loops = entry["Actual Loops"],
			estimated = entry["Plan Rows"];
		const removed = [
			entry["Rows Removed by Filter"],
			entry["Rows Removed by Join Filter"],
		].reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
		operators.push({
			type: entry["Node Type"],
			rows,
			loops,
			estimatedRows: estimated,
			rowsAcrossLoops: rows !== undefined && loops !== undefined ? rows * loops : undefined,
			qError: rows && estimated ? Math.max(rows / estimated, estimated / rows) : undefined,
			zeroMismatch:
				rows !== undefined && estimated !== undefined
					? (rows === 0) !== (estimated === 0)
					: undefined,
			removedRows: removed * (loops ?? 1),
			sortMethod: typeof entry["Sort Method"] === "string" ? entry["Sort Method"] : undefined,
			sortSpaceType:
				typeof entry["Sort Space Type"] === "string" ? entry["Sort Space Type"] : undefined,
			sortSpaceKb:
				typeof entry["Sort Space Used"] === "number" ? entry["Sort Space Used"] : undefined,
		});
		if (Array.isArray(entry.Plans)) entry.Plans.forEach(visit);
	};
	visit(plan.Plan);
	return {
		planningMs: plan["Planning Time"],
		executionMs: plan["Execution Time"],
		settings: plan.Settings ?? {},
		jit: plan.JIT,
		operators,
		sharedHits: plan.Plan["Shared Hit Blocks"] ?? 0,
		sharedReads: plan.Plan["Shared Read Blocks"] ?? 0,
		tempReads: plan.Plan["Temp Read Blocks"] ?? 0,
		tempWrites: plan.Plan["Temp Written Blocks"] ?? 0,
	};
}

/** Missing scenarios and failed phases remain failures, even if some requests succeeded. */
export function coverageReport(planned: readonly string[], executed: readonly string[]) {
	const completed = new Set(executed);
	return {
		planned: planned.length,
		executed: planned.filter((id) => completed.has(id)).length,
		missing: planned.filter((id) => !completed.has(id)),
		unexpected: [...completed].filter((id) => !planned.includes(id)),
	};
}
