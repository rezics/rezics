import { describe, expect, it, vi } from "vitest";
import { createCimdResourceFetch } from "./cimd-transport";

const resource = "https://cimd.example.com/metadata.json";
describe("CIMD network admission", () => {
	it.each([
		"http://cimd.example.com/metadata",
		"https://localhost/metadata",
		"https://127.0.0.1/metadata",
		"https://2130706433/metadata",
		"https://[::1]/metadata",
		"https://metadata.google.internal/metadata",
		"https://cimd.example.com/metadata#fragment",
		"https://user:secret@cimd.example.com/metadata",
	])("rejects %s before DNS", async (url) => {
		const resolve = vi.fn();
		await expect(createCimdResourceFetch({ resolve })(url)).rejects.toThrow();
		expect(resolve).not.toHaveBeenCalled();
	});

	it.each(
		[
			[],
			[{ address: "8.8.8.8", family: 6 }],
			[{ address: "other.example.com", family: 4 }],
			[
				{ address: "8.8.8.8", family: 4 },
				{ address: "192.168.1.1", family: 4 },
			],
			Array.from({ length: 65 }, () => ({ address: "8.8.8.8", family: 4 })),
		].map((answers) => ({ answers })),
	)("rejects malformed, mixed or excessive DNS answers", async ({ answers }) => {
		const resolve = vi.fn(async () => answers);
		await expect(createCimdResourceFetch({ resolve })(resource)).rejects.toThrow(/DNS answers/);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it("rejects unsupported methods, pre-abort and excessive limits without DNS", async () => {
		const resolve = vi.fn();
		const fetch = createCimdResourceFetch({ resolve });
		await expect(fetch(resource, { method: "POST", body: "private" })).rejects.toThrow(
			/GET and HEAD/,
		);
		await expect(fetch(resource, { signal: AbortSignal.abort() })).rejects.toThrow();
		expect(resolve).not.toHaveBeenCalled();
		expect(() => createCimdResourceFetch({ timeoutMs: 5001 })).toThrow();
		expect(() => createCimdResourceFetch({ maximumConcurrentRequests: 17 })).toThrow();
	});

	it("times out DNS without freeing its slot for unlimited unresolved work", async () => {
		const pending = Promise.withResolvers<readonly { address: string; family: number }[]>();
		const resolve = vi.fn(() => pending.promise);
		const fetch = createCimdResourceFetch({ resolve, maximumConcurrentRequests: 1, timeoutMs: 20 });
		await expect(fetch(resource)).rejects.toMatchObject({ name: "TimeoutError" });
		await expect(fetch(resource)).rejects.toThrow(/capacity unavailable/);
		expect(resolve).toHaveBeenCalledTimes(1);
		pending.resolve([{ address: "8.8.8.8", family: 4 }]);
		await new Promise(setImmediate);
		resolve.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
		await expect(fetch(resource)).rejects.toThrow(/DNS answers/);
		expect(resolve).toHaveBeenCalledTimes(2);
	});
});
