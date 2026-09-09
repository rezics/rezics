import { useState } from "react";
import { expect } from "storybook/test";
import { NativeSelect, NativeSelectOption, Field, FieldLabel, useUiMessages } from "@rezics/ui";
import preview from "./preview";

const meta = preview.meta({
	component: NativeSelect,
	tags: ["ai-generated"],
	render: function Render(args) {
		const [value, setValue] = useState("");
		const messages = useUiMessages();
		return (
			<Field>
				<FieldLabel>{messages.editor.style}</FieldLabel>
				<NativeSelect
					{...args}
					value={value}
					onChange={(event) => setValue(event.currentTarget.value)}
				>
					<NativeSelectOption value="">{messages.empty}</NativeSelectOption>
					<NativeSelectOption value="normal">{messages.editor.paragraph}</NativeSelectOption>
				</NativeSelect>
			</Field>
		);
	},
});
export default meta;
export const EmptyValue = meta.story({
	play: async ({ canvas, userEvent }) => {
		const select = canvas.getByRole("combobox");
		await userEvent.selectOptions(select, "normal");
		await expect(select).toHaveValue("normal");
		await userEvent.selectOptions(select, "");
		await expect(select).toHaveValue("");
	},
});
export const Dark = EmptyValue.extend({ globals: { theme: "dark" } });
