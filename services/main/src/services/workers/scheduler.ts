import { setTimeout as delay } from "node:timers/promises";

/** @internal Independent process-selectable workloads; each lane runs at most one job at a time. */
export const WorkerLaneValues = [
	"delivery",
	"canonical",
	"projection",
	"maintenance",
	"external",
] as const;
export type WorkerLane = (typeof WorkerLaneValues)[number];

/** @internal A recurring bounded batch, with the interval measured from completion. */
export interface ScheduledWorkerJob {
	readonly name: string;
	readonly intervalMs: number;
	readonly run: () => Promise<unknown>;
}

/**
 * Run a serial lane without letting a failed job skip later work or overlapping a slow batch.
 * @internal
 */
export async function runWorkerLane(
	jobs: readonly ScheduledWorkerJob[],
	options: {
		readonly signal: AbortSignal;
		readonly onStart: (name: string) => void;
		readonly onFinish: (name: string) => void;
		readonly onError: (name: string, error: unknown) => void;
	},
): Promise<void> {
	if (jobs.length === 0) return;
	if (
		new Set(jobs.map((job) => job.name)).size !== jobs.length ||
		jobs.some((job) => !Number.isSafeInteger(job.intervalMs) || job.intervalMs < 1)
	)
		throw new Error("Worker lane requires unique jobs with positive integer intervals");
	const nextAt = new Map(jobs.map((job) => [job.name, 0]));
	while (!options.signal.aborted) {
		for (const job of jobs) {
			if (options.signal.aborted) return;
			if (Date.now() < (nextAt.get(job.name) ?? 0)) continue;
			options.onStart(job.name);
			try {
				await job.run();
			} catch (error) {
				options.onError(job.name, error);
			} finally {
				nextAt.set(job.name, Date.now() + job.intervalMs);
				options.onFinish(job.name);
			}
		}
		if (options.signal.aborted) return;
		const waitMs = Math.max(1, Math.min(...nextAt.values()) - Date.now());
		try {
			await delay(waitMs, undefined, { signal: options.signal });
		} catch (error) {
			if (!options.signal.aborted) throw error;
		}
	}
}
