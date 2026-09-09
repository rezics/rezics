import { defineSchema } from "@portabletext/editor";
import { useState } from "react";
import { expect, fn, waitFor, userEvent as storyUserEvent } from "storybook/test";
import { useUiMessages } from "@rezics/ui";
import preview from "../../../libraries/ui/stories/preview";
import { PortableTextEditor } from "../src/portable-text/portable-text-editor";

const schemaDefinition = defineSchema({
	decorators: [{ name: "strong" }],
	styles: [{ name: "normal" }],
	annotations: [],
	lists: [],
	inlineObjects: [],
	blockObjects: [],
});
const meta = preview.meta({
	title: "Editor/Portable Text Core",
	component: PortableTextEditor,
	tags: ["ai-generated"],
	args: { schemaDefinition, value: [], onChange: fn() },
	render: function Render(args) {
		const [value, setValue] = useState(args.value);
		const messages = useUiMessages();
		return (
			<PortableTextEditor
				{...args}
				aria-label={messages.editor.richText}
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
export const Editing = meta.story({
	play: async ({ canvas, args }) => {
		const editor = await canvas.findByRole("textbox");
		await storyUserEvent.setup({ delay: 30 }).type(editor, "Reader notes");
		await waitFor(() => expect(args.onChange).toHaveBeenCalled());
		await expect(editor).toHaveTextContent("Reader notes");
	},
});
export const ReadOnly = meta.story({
	args: {
		readOnly: true,
		value: [
			{
				_type: "block",
				_key: "block",
				style: "normal",
				markDefs: [],
				children: [{ _type: "span", _key: "text", text: "Reader notes", marks: [] }],
			},
		],
	},
	play: async ({ canvas, args }) => {
		await expect(await canvas.findByText("Reader notes")).toBeVisible();
		await expect(args.onChange).not.toHaveBeenCalled();
	},
});
