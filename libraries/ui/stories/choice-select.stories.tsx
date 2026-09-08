import { useFeedFixtureData } from "@rezics/fixture-client";
import { ChoiceSelect, useUiMessages } from "@rezics/ui";
import { useState } from "react";
import { expect, within } from "storybook/test";
import preview from "./preview";

const meta = preview.meta({
	component: ChoiceSelect,
	tags: ["ai-generated"],
	args: { ariaLabel: "", placeholder: "", options: [], value: [], onValueChange: () => undefined },
	render: function Render(args) {
		const fixture = useFeedFixtureData();
		const messages = useUiMessages();
		const [value, setValue] = useState<readonly string[]>(args.value);
		return (
			<ChoiceSelect
				{...args}
				ariaLabel={fixture.collection.title}
				placeholder={String(messages.empty)}
				options={fixture.realms.map((realm) => ({ value: realm.id, label: realm.name }))}
				value={value}
				onValueChange={setValue}
			/>
		);
	},
});
export default meta;

export const Quiet = meta.story({
	play: async ({ canvas, canvasElement, userEvent }) => {
		const trigger = canvas.getByRole("combobox");
		await userEvent.click(trigger);
		const options = await within(canvasElement.ownerDocument.body).findAllByRole("option");
		const first = options[0];
		if (!first) throw new Error("The choice fixture must have an option");
		const label = first.textContent;
		await userEvent.click(first);
		await expect(trigger).toHaveTextContent(label ?? "");
		await expect(trigger).toHaveAttribute("aria-expanded", "false");
	},
});
export const Field = meta.story({ args: { appearance: "field" } });
export const Multiple = meta.story({ args: { multiple: true } });
