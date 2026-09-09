import { expect } from "storybook/test";
import { PortableTextContent } from "@rezics/ui";
import preview from "./preview";

const value = [
	{
		_type: "block",
		_key: "paragraph",
		style: "normal",
		markDefs: [{ _type: "spoiler", _key: "spoiler" }],
		children: [{ _type: "span", _key: "text", text: "Reader notes", marks: ["spoiler"] }],
	},
];
const meta = preview.meta({
	component: PortableTextContent,
	tags: ["ai-generated"],
	args: { value },
});
export default meta;
export const Concealed = meta.story({
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Reader notes")).not.toBeVisible();
	},
});
export const RevealWithKeyboard = meta.story({
	play: async ({ canvas, userEvent }) => {
		await userEvent.tab();
		await expect(canvas.getByRole("button")).toHaveFocus();
		await userEvent.keyboard("{Enter}");
		await expect(canvas.getByText("Reader notes")).toBeVisible();
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
});
