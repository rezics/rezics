import { useFeedFixtureData } from "@rezics/fixture-client";
import { Cover } from "@rezics/ui";
import preview from "./preview";

const meta = preview.meta({
	component: Cover,
	tags: ["ai-generated"],
	args: { alt: "", className: "w-48", priority: true },
	render: function Render(args) {
		const fixture = useFeedFixtureData();
		return (
			<Cover {...args} alt={fixture.collection.coverAlt} fallback={fixture.collection.title} />
		);
	},
});
export default meta;

export const Image = meta.story({ args: { src: "/fixtures/content-feed/book-cover.svg" } });
export const MissingImage = meta.story({ args: { src: null } });
