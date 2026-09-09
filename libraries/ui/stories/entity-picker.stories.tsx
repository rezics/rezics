import { useState } from "react";
import { expect, fn, waitFor, within } from "storybook/test";
import { EntityPicker, useUiMessages, type EntityPickerValue, type EntitySearch } from "@rezics/ui";
import preview from "./preview";

const hit = {
	id: "story-book",
	label: "Reader notes",
	owner: "publishing",
	shape: "work",
} as const;
const search: EntitySearch = fn(async () => [hit]);
const meta = preview.meta({
	component: EntityPicker,
	tags: ["ai-generated"],
	args: { ariaLabel: "", placeholder: "", index: "all", search, onChange: fn() },
	render: function Render(args) {
		const [value, setValue] = useState<EntityPickerValue>();
		const messages = useUiMessages();
		return (
			<EntityPicker
				{...args}
				value={value}
				ariaLabel={messages.editor.mentionSearchPrompt}
				placeholder={messages.editor.mentionSearchPrompt}
				onChange={(next) => {
					setValue(next);
					args.onChange(next);
				}}
			/>
		);
	},
});
export default meta;
export const SearchAndSelect = meta.story({
	play: async ({ canvas, canvasElement, userEvent, args }) => {
		await userEvent.type(canvas.getByRole("combobox"), "Reader");
		const option = await within(canvasElement.ownerDocument.body).findByRole("option", {
			name: hit.label,
		});
		await userEvent.click(option);
		await expect(args.onChange).toHaveBeenCalledWith(hit);
		await expect(canvas.getByRole("combobox")).toHaveValue(hit.label);
		await waitFor(() =>
			expect(canvas.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant"),
		);
	},
});
export const EmptyResults = meta.story({
	args: { search: fn(async () => []) },
	play: async ({ canvas, canvasElement, userEvent, loaded }) => {
		await userEvent.type(canvas.getByRole("combobox"), "Reader");
		await expect(await canvas.findByText(loaded.uiMessages.empty)).toBeVisible();
		await expect(canvas.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
		await expect(
			within(canvasElement.ownerDocument.body).queryByRole("option"),
		).not.toBeInTheDocument();
	},
});
export const SearchFailure = meta.story({
	args: {
		search: fn(async () => {
			throw new Error("Story search failed");
		}),
	},
	play: async ({ canvas, canvasElement, userEvent }) => {
		await userEvent.type(canvas.getByRole("combobox"), "Reader");
		await expect(await within(canvasElement.ownerDocument.body).findByRole("alert")).toBeVisible();
	},
});
export const ExcludedResult = meta.story({
	args: { excludedIds: new Set([hit.id]) },
	play: async ({ canvas, canvasElement, userEvent, loaded }) => {
		await userEvent.type(canvas.getByRole("combobox"), "Reader");
		await expect(await canvas.findByText(loaded.uiMessages.empty)).toBeVisible();
		await expect(canvas.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
		await expect(
			within(canvasElement.ownerDocument.body).queryByRole("option"),
		).not.toBeInTheDocument();
	},
});
export const PreloadedSelection = meta.story({
	args: { searchOnOpen: true },
	play: async ({ canvas, canvasElement, userEvent, args }) => {
		await userEvent.click(canvas.getByRole("combobox"));
		const option = await within(canvasElement.ownerDocument.body).findByRole("option", {
			name: hit.label,
		});
		await userEvent.keyboard("{ArrowDown}");
		await expect(canvas.getByRole("combobox")).toHaveAttribute("aria-activedescendant", option.id);
		await userEvent.click(option);
		await expect(args.onChange).toHaveBeenCalledWith(hit);
		await expect(canvas.getByRole("combobox")).toHaveValue(hit.label);
		await waitFor(() =>
			expect(canvas.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant"),
		);
	},
});
