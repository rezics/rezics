import { expect, within } from "storybook/test";
import preview from "@/.storybook/preview";
import { FeedListControls } from "../data/api-feed-list";
import { FeedListItems } from "./feed-list";
import { FixtureFeedItems, FullFeedListFixture } from "./feed-list.fixture";

const meta = preview.meta({
	component: FeedListItems,
	subcomponents: { FeedListControls },
	tags: ["ai-generated"],
});
export default meta;

export const FullFeed = meta.story({
	globals: { locale: "en", contentLanguage: "en" },
	render: () => <FullFeedListFixture />,
	play: async ({ canvas, canvasElement, userEvent }) => {
		const sorting = canvas.getByRole("combobox", { name: "Feed sorting" });
		await userEvent.click(sorting);
		await userEvent.click(
			await within(canvasElement.ownerDocument.body).findByRole("option", { name: "New" }),
		);
		await expect(sorting).toHaveTextContent("New");
	},
});
export const PostList = meta.story({ render: () => <FixtureFeedItems /> });
