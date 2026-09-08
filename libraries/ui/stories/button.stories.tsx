import { Button, useUiMessages } from "@rezics/ui";
import { expect, fn, mocked } from "storybook/test";
import preview from "./preview";

const meta = preview.meta({
	component: Button,
	tags: ["ai-generated"],
	render: function Render(args) {
		const messages = useUiMessages();
		return <Button {...args}>{args.children ?? messages.retry}</Button>;
	},
});
export default meta;

export const Quiet = meta.story({
	args: { onClick: fn() },
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button"));
		await expect(args.onClick).toHaveBeenCalledOnce();
	},
});
export const Brand = meta.story({ args: { variant: "brand" } });
export const Solid = meta.story({ args: { variant: "solid" } });
export const Disabled = meta.story({ args: { disabled: true } });
export const CssCheck = meta.story({
	play: async ({ canvas }) => {
		const style = getComputedStyle(canvas.getByRole("button"));
		await expect(style.display).toBe("inline-flex");
		await expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
	},
});

Quiet.test("Keyboard activation", async ({ args, canvas, userEvent }) => {
	if (!args.onClick) throw new Error("Keyboard story requires a click callback");
	mocked(args.onClick).mockClear();
	canvas.getByRole("button").focus();
	await userEvent.keyboard("{Enter}");
	await expect(args.onClick).toHaveBeenCalledOnce();
});
