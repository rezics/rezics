import { afterEach, describe, expect, it, vi } from "vitest";
import { client as fetchClient } from "@rezics/openapi-fetch";
import { client as queryClient } from "@rezics/openapi-tanstack-query";

afterEach(() => vi.unstubAllGlobals());
describe("first-party API cookie transport", () => {
	it.each([fetchClient, queryClient])(
		"includes session cookies in cross-origin Request objects",
		async (client) => {
			let sent: Request | undefined;
			vi.stubGlobal("fetch", async (request: Request) => {
				sent = request;
				return Response.json({ ok: true });
			});
			await client({ url: "https://api.example.invalid/account", method: "GET" });
			expect(sent?.credentials).toBe("include");
			expect(sent?.headers.has("X-Rezics-Participation")).toBe(false);
		},
	);
});
