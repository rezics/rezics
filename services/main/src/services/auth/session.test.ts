import Elysia from "elysia";
import { describe, expect, it, vi } from "vitest";

import type { ApiQuotaLease } from "./api-quota/limit-store";
import session, { trackRequestLimitLease } from "./session";

async function afterResponse(): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function trackedLease(release: () => void | Promise<void>): ApiQuotaLease {
	return {
		async release() {
			await release();
		},
	};
}

describe("API quota request lifecycle", () => {
	it("releases each sequential request before admitting the next request", async () => {
		let activeRequests = 0;
		const app = new Elysia().use(session).get("/", ({ request, status }) => {
			if (activeRequests >= 1) return status(429, "concurrency exceeded");
			activeRequests += 1;
			trackRequestLimitLease(
				request,
				trackedLease(() => {
					activeRequests -= 1;
				}),
			);
			return "ok";
		});

		for (let requestNumber = 0; requestNumber < 10; requestNumber += 1) {
			const response = await app.handle(new Request("http://localhost/"));
			expect(response.status).toBe(200);
			await afterResponse();
			expect(activeRequests).toBe(0);
		}
	});

	it("releases a lease after a handler error", async () => {
		const release = vi.fn();
		const app = new Elysia().use(session).get("/", ({ request }) => {
			trackRequestLimitLease(request, trackedLease(release));
			throw new Error("request failed");
		});

		const response = await app.handle(new Request("http://localhost/"));
		await afterResponse();

		expect(response.status).toBe(500);
		expect(release).toHaveBeenCalledOnce();
	});

	it("releases every lease attached to the same request", async () => {
		const firstRelease = vi.fn();
		const secondRelease = vi.fn();
		const app = new Elysia().use(session).get("/", ({ request }) => {
			trackRequestLimitLease(request, trackedLease(firstRelease));
			trackRequestLimitLease(request, trackedLease(secondRelease));
			return "ok";
		});

		const response = await app.handle(new Request("http://localhost/"));
		await afterResponse();

		expect(response.status).toBe(200);
		expect(firstRelease).toHaveBeenCalledOnce();
		expect(secondRelease).toHaveBeenCalledOnce();
	});

	it("owns leases acquired by descendant route plugins", async () => {
		const release = vi.fn();
		const child = new Elysia().use(session).get("/child", ({ request }) => {
			trackRequestLimitLease(request, trackedLease(release));
			return "ok";
		});
		const app = new Elysia().use(session).use(child);

		const response = await app.handle(new Request("http://localhost/child"));
		await afterResponse();

		expect(response.status).toBe(200);
		expect(release).toHaveBeenCalledOnce();
	});
});
