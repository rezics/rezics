import { expect, fn } from "storybook/test";
import preview from "@/.storybook/preview";
import { SlugAddressForm } from "./slug-address-form";

const meta = preview.meta({
	component: SlugAddressForm,
	tags: ["ai-generated"],
	args: { isPending: false, error: null, onSubmit: fn(async () => undefined) },
});
export default meta;
export const AssignOnce = meta.story({
	args: { mode: "assign-once" },
	play: async ({ canvas, userEvent, args }) => {
		await userEvent.type(canvas.getByRole("textbox"), "reader-notes");
		await userEvent.click(canvas.getByRole("button"));
		await expect(args.onSubmit).toHaveBeenCalledWith("reader-notes");
		await expect(canvas.getByRole("textbox")).toBeDisabled();
		await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
	},
});
export const Reserved = meta.story({
	args: { mode: "assign-once" },
	play: async ({ canvas, userEvent, args }) => {
		await userEvent.type(canvas.getByRole("textbox"), "admin");
		await userEvent.click(canvas.getByRole("button"));
		await expect(await canvas.findByRole("alert")).toBeVisible();
		await expect(args.onSubmit).not.toHaveBeenCalled();
	},
});
export const AlreadyAssigned = meta.story({
	args: { mode: "assign-once", initialSlug: "reader-notes" },
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("textbox")).toBeDisabled();
	},
});
export const Pending = meta.story({
	args: { initialSlug: "reader-notes", isPending: true },
	play: async ({ canvas, userEvent, args }) => {
		await expect(canvas.getByRole("button")).toBeDisabled();
		await userEvent.type(canvas.getByRole("textbox"), "{Enter}");
		await expect(args.onSubmit).not.toHaveBeenCalled();
	},
});
export const Rejected = meta.story({
	args: {
		initialSlug: "reader-notes",
		onSubmit: fn(async () => {
			throw new Error("Story submission rejected");
		}),
	},
	play: async ({ canvas, userEvent, args }) => {
		await userEvent.click(canvas.getByRole("button"));
		await expect(args.onSubmit).toHaveBeenCalled();
		await expect(canvas.getByRole("textbox")).toBeEnabled();
		await expect(canvas.getByRole("button")).toBeEnabled();
	},
});
