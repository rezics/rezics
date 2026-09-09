import { useState } from "react";
import { expect, fn, within, waitFor } from "storybook/test";
import type { SimpleFeedContentKind } from "@rezics/filter";
import preview from "@/.storybook/preview";
import { FeedContentSelector } from "./feed-content-selector";

const options: readonly SimpleFeedContentKind[] = ["post:post", "publishing:work"];
const meta = preview.meta({
	component: FeedContentSelector,
	tags: ["ai-generated"],
	args: { value: [], options, onValueChange: fn() },
	render: function Render(args) {
		const [value, setValue] = useState(args.value);
		return (
			<FeedContentSelector
				{...args}
				value={value}
				onValueChange={(next) => {
					setValue(next);
					args.onValueChange(next);
				}}
			/>
		);
	},
});
export default meta;
export const FilterAndClear = meta.story({
	play: async ({ canvas, canvasElement, userEvent, args }) => {
		const trigger = canvas.getByRole("button");
		await userEvent.click(trigger);
		const body = within(canvasElement.ownerDocument.body);
		const choices = await body.findAllByRole("menuitemcheckbox");
		const first = choices[0];
		if (!first) throw new Error("Expected a content option");
		await userEvent.click(first);
		await expect(choices[0]).toHaveAttribute("aria-checked", "true");
		await expect(args.onValueChange).toHaveBeenCalled();
		await userEvent.click(body.getByRole("menuitem"));
		await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(trigger).toHaveFocus());
	},
});
export const Mobile = FilterAndClear.extend({
	globals: { viewport: { value: "mobile", isRotated: false } },
});
