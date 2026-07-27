import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
	postApiSearchFeaturesByTemplateExecute: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => api);

import { fetchProfileContentPage } from "./profile-content-query";

const ProfileId = "019b0000-0000-7000-8000-000000000004";

beforeEach(() => {
	api.postApiSearchFeaturesByTemplateExecute.mockReset();
	api.postApiSearchFeaturesByTemplateExecute.mockResolvedValue({
		data: { query: "", groups: [] },
	});
});

describe("Profile content page requests", () => {
	it("uses the canonical Profile Search context", async () => {
		const signal = new AbortController().signal;

		await fetchProfileContentPage({ profileId: ProfileId, signal });

		expect(api.postApiSearchFeaturesByTemplateExecute).toHaveBeenCalledWith({
			path: { template: "global" },
			body: {
				contexts: [{ kind: "profile", profileId: ProfileId }],
				injections: [],
				state: {
					pageSize: 10,
					sort: "updatedAt:desc",
				},
			},
			signal,
			throwOnError: true,
		});
	});

	it("adds the server-issued grouped continuation cursor", async () => {
		await fetchProfileContentPage({
			cursor: "s2_cursor",
			profileId: ProfileId,
		});

		expect(api.postApiSearchFeaturesByTemplateExecute).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					state: {
						cursor: "s2_cursor",
						pageSize: 10,
						sort: "updatedAt:desc",
					},
				}),
			}),
		);
	});
});
