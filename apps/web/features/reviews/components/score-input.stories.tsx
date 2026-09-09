import { useState } from "react";
import { expect, fn } from "storybook/test";
import preview from "@/.storybook/preview";
import { ScoreInput } from "./score-input";

const meta = preview.meta({
	component: ScoreInput,
	tags: ["ai-generated"],
	args: { value: undefined, onChange: fn() },
	render: function Render(args) {
		const [value, setValue] = useState(args.value);
		return (
			<ScoreInput
				{...args}
				value={value}
				onChange={(next) => {
					setValue(next);
					args.onChange(next);
				}}
			/>
		);
	},
});
export default meta;
export const OptionalScore = meta.story({
	play: async ({ canvas, userEvent, args }) => {
		const select = canvas.getByRole("combobox");
		await userEvent.selectOptions(select, "10");
		await expect(select).toHaveValue("10");
		await expect(args.onChange).toHaveBeenLastCalledWith(10);
		await userEvent.selectOptions(select, "");
		await expect(args.onChange).toHaveBeenLastCalledWith(undefined);
	},
});
export const LockedScore = meta.story({
	args: { value: 7, disabled: true },
	play: async ({ canvas, args }) => {
		await expect(canvas.getByRole("combobox")).toBeDisabled();
		await expect(args.onChange).not.toHaveBeenCalled();
	},
});
