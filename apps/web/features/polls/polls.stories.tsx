import { delay, http, HttpResponse } from "msw";
import { expect, waitFor } from "storybook/test";
import type { GetApiPollsByPollIdStatus200 } from "@rezics/openapi-tanstack-query";
import preview from "@/.storybook/preview";
import { openStoryAuthPortal } from "@/.storybook/providers";
import { PollDetail } from "./polls";

const poll = {
	id: "00000000-0000-4000-8000-000000000701",
	language: "en",
	question: "Which reading format do you prefer?",
	voteMode: "single",
	anonymous: false,
	resultsVisibility: "always",
	closesAt: null,
	createdAt: "2026-07-20T12:00:00.000Z",
	closed: false,
	viewerOptionIds: [],
	options: [
		{
			id: "00000000-0000-4000-8000-000000000702",
			sourceKind: "literal",
			targetUnitId: null,
			label: "Digital",
			position: 0,
			voteCount: 5,
		},
		{
			id: "00000000-0000-4000-8000-000000000703",
			sourceKind: "literal",
			targetUnitId: null,
			label: "Print",
			position: 1,
			voteCount: 3,
		},
	],
} satisfies GetApiPollsByPollIdStatus200;
const meta = preview.meta({
	component: PollDetail,
	tags: ["ai-generated"],
	globals: { locale: "en", contentLanguage: "en" },
	args: { id: poll.id },
	beforeEach({ msw }) {
		msw.use(http.get("*/api/v1/polls/:id", () => HttpResponse.json(poll)));
	},
});
export default meta;
export const AnonymousVoting = meta.story({
	play: async ({ canvas, userEvent }) => {
		await expect(await canvas.findByRole("heading", { name: poll.question })).toBeVisible();
		await expect(canvas.getAllByRole("radio")[0]).toBeDisabled();
		await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
		await expect(openStoryAuthPortal).toHaveBeenCalledWith("login", {
			destination: `/polls/${poll.id}`,
		});
	},
});
export const Closed = meta.story({
	beforeEach({ msw }) {
		msw.use(http.get("*/api/v1/polls/:id", () => HttpResponse.json({ ...poll, closed: true })));
	},
	play: async ({ canvas }) => {
		await canvas.findByRole("heading", { name: poll.question });
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
});
export const HiddenResults = meta.story({
	beforeEach({ msw }) {
		msw.use(
			http.get("*/api/v1/polls/:id", () =>
				HttpResponse.json({
					...poll,
					options: poll.options.map((option) => ({ ...option, voteCount: null })),
				}),
			),
		);
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("heading", { name: poll.question })).toBeVisible();
	},
});
export const Loading = meta.story({
	beforeEach({ msw }) {
		msw.use(
			http.get("*/api/v1/polls/:id", async () => {
				await delay("infinite");
				return HttpResponse.json(poll);
			}),
		);
	},
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("status")).toBeVisible();
	},
});
export const RetryAfterFailure = meta.story({
	beforeEach({ msw }) {
		let attempt = 0;
		msw.use(
			http.get("*/api/v1/polls/:id", () =>
				++attempt === 1
					? HttpResponse.json({ error: { code: "PollNotFound" } }, { status: 404 })
					: HttpResponse.json(poll),
			),
		);
	},
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(await canvas.findByRole("button", { name: "Retry" }));
		await waitFor(() => expect(canvas.getByRole("heading", { name: poll.question })).toBeVisible());
	},
});
