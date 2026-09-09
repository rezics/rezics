import { expect } from "storybook/test";
import { ShowMoreContent } from "@rezics/ui";
import { useFeedFixtureData } from "@rezics/fixture-client";
import preview from "./preview";

const meta = preview.meta({
	component: ShowMoreContent,
	tags: ["ai-generated"],
	args: { showMoreLabel: "", showLessLabel: "", children: null },
	render: function Render(args, { loaded }) {
		const fixture = useFeedFixtureData();
		return (
			<ShowMoreContent
				{...args}
				showMoreLabel={loaded.labels.ui.showMore}
				showLessLabel={loaded.labels.ui.showLess}
			>
				{Array.from({ length: args.collapsedClassName ? 1 : 10 }, (_, index) => (
					<p key={index}>{fixture.collection.body}</p>
				))}
			</ShowMoreContent>
		);
	},
});
export default meta;
export const Overflow = meta.story({
	play: async ({ canvas, userEvent }) => {
		const toggle = await canvas.findByRole("button");
		await expect(toggle).toHaveAttribute("aria-expanded", "false");
		await userEvent.click(toggle);
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		await userEvent.click(toggle);
		await expect(toggle).toHaveAttribute("aria-expanded", "false");
	},
});
export const Fits = meta.story({
	args: { collapsedClassName: "max-h-96" },
	play: async ({ canvas }) => {
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
});
