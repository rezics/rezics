import { useFeedFixtureData } from "@rezics/fixture-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rezics/ui";
import preview from "./preview";

const meta = preview.meta({
	component: Card,
	subcomponents: { CardContent, CardDescription, CardHeader, CardTitle },
	tags: ["ai-generated"],
	render: function Render(args) {
		const fixture = useFeedFixtureData();
		return (
			<Card {...args}>
				<CardHeader>
					<CardTitle>{fixture.collection.title}</CardTitle>
					<CardDescription>{fixture.attributions[0].name}</CardDescription>
				</CardHeader>
				<CardContent>{fixture.collection.body}</CardContent>
			</Card>
		);
	},
});
export default meta;

export const Ghost = meta.story();
export const Elevated = meta.story({ args: { appearance: "elevated" } });
export const Outlined = meta.story({ args: { appearance: "outlined" } });
