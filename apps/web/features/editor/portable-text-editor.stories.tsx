import { useState } from "react";
import { expect, fn, waitFor, userEvent as storyUserEvent } from "storybook/test";
import preview from "@/.storybook/preview";
import { PortableTextEditor } from "./portable-text-editor";

const meta = preview.meta({
	component: PortableTextEditor,
	tags: ["ai-generated"],
	loaders: [
		async () => {
			await import("@rezics/ui/custom/portable-text-editor");
			return {};
		},
	],
	args: { value: [], onChange: fn() },
	render: function Render(args) {
		const [value, setValue] = useState(args.value);
		return (
			<PortableTextEditor
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
export const CompactEditing = meta.story({
	play: async ({ canvas, userEvent, args }) => {
		const editor = await canvas.findByRole("textbox");
		await userEvent.click(editor);
		await storyUserEvent.setup({ delay: 30 }).type(editor, "Reader notes");
		await expect(editor).toHaveTextContent("Reader notes");
		await waitFor(() => expect(args.onChange).toHaveBeenCalled());
	},
});
export const DocumentPreview = meta.story({
	args: { variant: "document" },
	play: async ({ canvas }) => {
		const editor = await canvas.findByRole("textbox");
		await storyUserEvent.setup({ delay: 30 }).type(editor, "Reader notes");
		await waitFor(() => expect(canvas.getAllByText("Reader notes")).toHaveLength(2));
	},
});
export const SpoilerToolbar = meta.story({
	args: { capabilities: { spoilers: true } },
	globals: { locale: "en" },
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("button", { name: /spoiler/i })).toBeVisible();
	},
});
