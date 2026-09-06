import { afterEach, describe, expect, it, vi } from "vitest";

import { runWorkerLane } from "./scheduler";

afterEach(() => vi.useRealTimers());

function callbacks(signal: AbortSignal) {
	return { signal, onStart: vi.fn(), onFinish: vi.fn(), onError: vi.fn() };
}

describe("worker lane scheduling", () => {
	it("continues later jobs after a failed batch", async () => {
		const stop = new AbortController();
		const options = callbacks(stop.signal);
		const failure = new Error("batch failed");
		const next = vi.fn(async () => {
			stop.abort();
		});
		await runWorkerLane(
			[
				{
					name: "failed",
					intervalMs: 1_000,
					run: async () => {
						throw failure;
					},
				},
				{ name: "next", intervalMs: 1_000, run: next },
			],
			options,
		);
		expect(next).toHaveBeenCalledOnce();
		expect(options.onError).toHaveBeenCalledWith("failed", failure);
		expect(options.onFinish).toHaveBeenCalledTimes(2);
	});

	it("lets delivery finish while an external lane is suspended and drains active work on stop", async () => {
		const stop = new AbortController();
		const externalResult = Promise.withResolvers<void>();
		const external = vi.fn(() => externalResult.promise);
		const options = callbacks(stop.signal);
		const pending = runWorkerLane([{ name: "model", intervalMs: 1_000, run: external }], options);
		const delivery = vi.fn(async () => {
			stop.abort();
		});
		await runWorkerLane(
			[{ name: "email", intervalMs: 1_000, run: delivery }],
			callbacks(stop.signal),
		);
		expect(delivery).toHaveBeenCalledOnce();
		expect(external).toHaveBeenCalledOnce();
		expect(options.onFinish).not.toHaveBeenCalled();
		externalResult.resolve();
		await pending;
		expect(options.onFinish).toHaveBeenCalledWith("model");
	});

	it("never overlaps a slow batch or starts another job after stop", async () => {
		const stop = new AbortController();
		const batch = Promise.withResolvers<void>();
		const run = vi.fn(() => batch.promise);
		const later = vi.fn(async () => undefined);
		const pending = runWorkerLane(
			[
				{ name: "slow", intervalMs: 1, run },
				{ name: "later", intervalMs: 1, run: later },
			],
			callbacks(stop.signal),
		);
		stop.abort();
		batch.resolve();
		await pending;
		expect(run).toHaveBeenCalledOnce();
		expect(later).not.toHaveBeenCalled();
	});

	it("interrupts long polling sleep promptly on shutdown", async () => {
		const stop = new AbortController();
		const ran = Promise.withResolvers<void>();
		const run = vi.fn(async () => {
			ran.resolve();
		});
		const pending = runWorkerLane(
			[{ name: "periodic", intervalMs: 60_000, run }],
			callbacks(stop.signal),
		);
		await ran.promise;
		await Promise.resolve();
		stop.abort();
		await pending;
		expect(run).toHaveBeenCalledOnce();
	});
});
