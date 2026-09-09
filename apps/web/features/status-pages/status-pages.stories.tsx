import { expect, fn } from "storybook/test";
import preview from "@/.storybook/preview";
import { ErrorPage } from "./error-page";
import { ForbiddenPage } from "./forbidden-page";
import { NotFoundPage } from "./not-found-page";

const meta = preview.meta({
	component: ErrorPage,
	subcomponents: { ForbiddenPage, NotFoundPage },
	tags: ["ai-generated"],
	args: { reset: fn() },
});
export default meta;
export const Retry = meta.story({
	play: async ({ canvas, userEvent, args }) => {
		await userEvent.click(canvas.getByRole("button"));
		await expect(args.reset).toHaveBeenCalledOnce();
	},
});
export const Forbidden = meta.story({
	render: () => <ForbiddenPage />,
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link")).toHaveAttribute("href", "/");
		await expect(canvas.getByText("403")).toBeVisible();
	},
});
export const Missing = meta.story({
	render: () => <NotFoundPage />,
	globals: { viewport: { value: "mobile", isRotated: false } },
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("link")).toHaveAttribute("href", "/");
		await expect(canvas.getByText("404")).toBeVisible();
	},
});
