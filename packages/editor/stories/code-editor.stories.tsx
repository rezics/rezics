import { useState } from "react";
import { expect, fn, userEvent as storyUserEvent } from "storybook/test";
import { CodeEditor } from "../src/codemirror/code-editor";
import { rezicsMarkdown } from "../src/markdown/language";
import preview from "../../../libraries/ui/stories/preview";
import { useUiMessages } from "@rezics/ui";

const markdownExtensions = [rezicsMarkdown()];
const meta = preview.meta({
	title: "Editor/CodeMirror",
	component: CodeEditor,
	tags: ["ai-generated"],
	argTypes: { extensions: { control: false } },
	args: { value: "# REZICS\n", ariaLabel: "", onChange: fn() },
	render: function Render(args) {
		const [value, setValue] = useState(args.value);
		const messages = useUiMessages();
		return (
			<CodeEditor
				{...args}
				extensions={markdownExtensions}
				ariaLabel={messages.editor.richText}
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
export const EditMarkdown = meta.story({
	play: async ({ canvas, userEvent, args }) => {
		const editor = await canvas.findByRole("textbox");
		await userEvent.click(editor);
		await userEvent.keyboard("{Control>}{End}{/Control}");
		await storyUserEvent.setup({ delay: 30 }).type(editor, "Reader notes", { skipClick: true });
		await expect(editor).toHaveTextContent("Reader notes");
		await expect(args.onChange).toHaveBeenLastCalledWith(expect.stringContaining("Reader notes"));
	},
});
export const ReadOnly = meta.story({
	args: { readOnly: true },
	play: async ({ canvas, args }) => {
		const editor = await canvas.findByRole("textbox");
		await expect(editor).toHaveAttribute("contenteditable", "false");
		await expect(args.onChange).not.toHaveBeenCalled();
	},
});
export const Empty = meta.story({
	args: { value: "" },
	play: async ({ canvas }) => {
		await expect(await canvas.findByRole("textbox")).toBeVisible();
	},
});
