import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import api from ".";

const ErrorBody = z.object({
	error: z.object({ code: z.string(), message: z.string() }),
	requestId: z.uuid(),
});

async function readErrorBody(response: Response) {
	return ErrorBody.parse(await response.json());
}

describe("API root", () => {
	it("serves health checks without dependencies", async () => {
		const get = await api.handle(new Request("http://localhost/api/health"));
		const head = await api.handle(
			new Request("http://localhost/api/health", { method: "HEAD" }),
		);

		expect(get.status).toBe(StatusCodes.OK);
		expect(await get.json()).toEqual({ status: "ok" });
		expect(head.status).toBe(StatusCodes.NO_CONTENT);
		expect(await head.text()).toBe("");
	});

	it("maps authentication and validation failures to the public error contract", async () => {
		const headers = {
			"Accept-Language": "zh-CN",
			"X-Request-Id": "caller-controlled",
		};
		const unauthorized = await api.handle(
			new Request("http://localhost/api/users/me", { headers }),
		);
		const validation = await api.handle(
			new Request("http://localhost/api/units/book?limit=0", { headers }),
		);

		expect(unauthorized.status).toBe(StatusCodes.UNAUTHORIZED);
		expect(unauthorized.headers.has("X-Request-Id")).toBe(false);
		expect(unauthorized.headers.has("Content-Language")).toBe(false);
		expect((await readErrorBody(unauthorized)).error).toEqual({
			code: "AuthenticationRequired",
			message: "Authentication required",
		});

		expect(validation.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
		expect(validation.headers.has("X-Request-Id")).toBe(false);
		expect((await readErrorBody(validation)).error).toEqual({
			code: "ValidationError",
			message: "Request validation failed",
		});
	});

	it("preserves unmatched routes as not found", async () => {
		const response = await api.handle(new Request("http://localhost/__test/unknown"));

		expect(response.status).toBe(StatusCodes.NOT_FOUND);
	});
});
