import { useFeedFixtureData } from "@rezics/fixture-client";
import { IdentityAvatar, type IdentityAvatarProps } from "@rezics/ui";
import preview from "./preview";

const meta = preview.meta({
	component: IdentityAvatar,
	tags: ["ai-generated"],
	args: { fallback: "", size: "lg" } satisfies IdentityAvatarProps,
	render: function Render(args) {
		const fixture = useFeedFixtureData();
		return (
			<IdentityAvatar
				{...args}
				fallback={fixture.attributions[0].initials}
				imageAlt={fixture.attributions[0].name}
			/>
		);
	},
});
export default meta;

export const Initials = meta.story();
export const Emoji = meta.story({ args: { avatar: { type: "emoji", emoji: "🐬" } } });
