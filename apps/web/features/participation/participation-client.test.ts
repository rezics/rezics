import { describe, expect, it } from "vitest";
import { client, type ResolvedRequest, type Transport } from "@rezics/openapi-tanstack-query";
import { createParticipationClient } from "./participation-client";

describe("explicit participation request transport", () => {
	it("keeps two grant revisions isolated and leaves the account client untouched", async () => {
		const initial = client.getConfig();
		const requests: ResolvedRequest[] = [];
		const transport: Transport = async (request) => {
			requests.push(request);
			return {
				data: {},
				status: 200,
				statusText: "OK",
				headers: new Headers(),
				request: new Request(request.url),
				response: new Response("{}"),
			};
		};
		const actingEntityId = "019b76da-a800-7100-8000-000000000001";
		const id = "019b76da-a800-7100-8000-000000000002";
		const first = createParticipationClient({ actingEntityId, grant: { id, revision: 1 } });
		const second = createParticipationClient({ actingEntityId, grant: { id, revision: 2 } });
		const account = createParticipationClient({ actingEntityId, grant: null });
		await first({ url: "https://fixture.invalid/operation", transport });
		await second({ url: "https://fixture.invalid/operation", transport });
		await account({ url: "https://fixture.invalid/operation", transport });
		expect(
			requests.map((request) => new Headers(request.headers).get("X-Rezics-Participation")),
		).toEqual([
			JSON.stringify({ actingEntityId, grant: { id, revision: 1 } }),
			JSON.stringify({ actingEntityId, grant: { id, revision: 2 } }),
			null,
		]);
		expect(
			requests.every(
				(request) => (request.credentials ?? request.options?.credentials) === "include",
			),
		).toBe(true);
		expect(client.getConfig()).toEqual(initial);
	});
});
