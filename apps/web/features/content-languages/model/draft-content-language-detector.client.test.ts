import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workerInstances: DetectionWorkerStub[] = [];

class DetectionWorkerStub {
	readonly messages: unknown[] = [];
	readonly url: string | URL;
	readonly #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

	constructor(url: string | URL) {
		this.url = url;
		workerInstances.push(this);
	}

	addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
		const listeners = this.#listeners.get(type) ?? new Set();
		listeners.add(listener);
		this.#listeners.set(type, listeners);
	}

	emitMessage(data: unknown): void {
		const event = new MessageEvent("message", { data });
		for (const listener of this.#listeners.get("message") ?? [])
			if (typeof listener === "function") listener(event);
			else listener.handleEvent(event);
	}

	postMessage(message: unknown): void {
		this.messages.push(message);
	}

	terminate(): void {}
}

beforeEach(() => {
	workerInstances.length = 0;
	vi.resetModules();
	vi.stubGlobal("Worker", DetectionWorkerStub);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("draft content language detector client", () => {
	it("loads the detection worker from a browser-served URL", async () => {
		const { detectDraftContentLanguageInBrowser } =
			await import("./draft-content-language-detector.client");
		const signal = new AbortController().signal;
		const detection = detectDraftContentLanguageInBrowser(
			"A sufficiently long sample.",
			signal,
		);

		expect(workerInstances).toHaveLength(1);
		const [worker] = workerInstances;
		if (!worker) throw new Error("The detection worker was not created.");
		expect(String(worker.url)).not.toMatch(/^file:/);
		expect(worker.messages).toEqual([{ id: 1, sample: "A sufficiently long sample." }]);

		worker.emitMessage({
			id: 1,
			result: { status: "detected", language: "en" },
		});
		await expect(detection).resolves.toEqual({
			status: "detected",
			language: "en",
		});
	});
});
