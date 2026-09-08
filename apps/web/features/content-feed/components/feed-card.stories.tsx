import { expect, waitFor, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { FeedCard } from "./feed-card";
import { FeedShareSurfaceView, FeedVoteControl } from "./feed-card-actions";
import {
	BookFeedCard,
	CollectionFeedCard,
	PostFeedCard,
	ReviewFeedCard,
} from "./feed-card.fixture";

const meta = preview.meta({
	component: FeedCard,
	subcomponents: { FeedVoteControl, FeedShareSurfaceView },
	tags: ["ai-generated"],
});
export default meta;

export const PostWithMedia = meta.story({ render: () => <PostFeedCard /> });
export const Review = meta.story({ render: () => <ReviewFeedCard /> });
export const Book = meta.story({ render: () => <BookFeedCard /> });
export const ShareDialogOpen = PostWithMedia.extend({
	globals: { locale: "en", contentLanguage: "en" },
	play: async ({ canvas, canvasElement, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Share content" }));
		await expect(await within(canvasElement.ownerDocument.body).findByRole("dialog")).toBeVisible();
	},
});
export const Collection = meta.story({
	globals: { locale: "en", contentLanguage: "en" },
	render: () => <CollectionFeedCard />,
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "Follow" }));
		await expect(canvas.getByRole("button", { name: "Unfollow" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	},
});

PostWithMedia.test(
	"Vote toggle",
	{
		globals: { locale: "en", contentLanguage: "en" },
	},
	async ({ canvas, userEvent }) => {
		const upvote = canvas.getByRole("button", { name: "Upvote" });
		await userEvent.click(upvote);
		await expect(upvote).toHaveAttribute("aria-pressed", "true");
		await userEvent.click(upvote);
		await expect(upvote).toHaveAttribute("aria-pressed", "false");
	},
);

PostWithMedia.test(
	"Share dialog restores focus",
	{
		globals: { locale: "en", contentLanguage: "en" },
	},
	async ({ canvas, canvasElement, userEvent }) => {
		const trigger = canvas.getByRole("button", { name: "Share content" });
		await userEvent.click(trigger);
		const body = within(canvasElement.ownerDocument.body);
		await expect(await body.findByRole("dialog")).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
		await waitFor(() => expect(trigger).toHaveFocus());
	},
);
