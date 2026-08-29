export const DatabasePoolWaitObservationWindowMilliseconds = 60_000;
export const MaximumDatabasePoolWaitSamples = 1_024;

interface DatabasePoolWaitSample {
	readonly durationMilliseconds: number;
	readonly observedAtMilliseconds: number;
}

/**
 * Keeps a process-local, time-bounded view of PostgreSQL client-acquisition wait.
 * The fixed sample ceiling prevents observability state from growing with traffic.
 */
export class DatabasePoolWaitTracker {
	readonly #samples: DatabasePoolWaitSample[] = [];

	record(durationMilliseconds: number, observedAtMilliseconds = Date.now()): void {
		if (
			!Number.isFinite(durationMilliseconds) ||
			durationMilliseconds < 0 ||
			!Number.isFinite(observedAtMilliseconds) ||
			observedAtMilliseconds < 0
		)
			throw new RangeError("Database pool wait samples must be finite and non-negative");
		this.#prune(observedAtMilliseconds);
		this.#samples.push({ durationMilliseconds, observedAtMilliseconds });
		if (this.#samples.length > MaximumDatabasePoolWaitSamples)
			this.#samples.splice(0, this.#samples.length - MaximumDatabasePoolWaitSamples);
	}

	p95Milliseconds(nowMilliseconds = Date.now()): number {
		if (!Number.isFinite(nowMilliseconds))
			throw new RangeError("Database pool wait observation time must be finite");
		this.#prune(nowMilliseconds);
		if (this.#samples.length === 0) return 0;
		const sorted = this.#samples
			.map(({ durationMilliseconds }) => durationMilliseconds)
			.sort((left, right) => left - right);
		return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
	}

	#prune(nowMilliseconds: number): void {
		const cutoff = nowMilliseconds - DatabasePoolWaitObservationWindowMilliseconds;
		for (let index = this.#samples.length - 1; index >= 0; index -= 1)
			if ((this.#samples[index]?.observedAtMilliseconds ?? cutoff) < cutoff)
				this.#samples.splice(index, 1);
	}
}
