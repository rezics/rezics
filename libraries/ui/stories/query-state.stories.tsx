import { QueryFailure, QueryPending } from "@rezics/ui";
import { expect, fn } from "storybook/test";
import preview from "./preview";

const meta = preview.meta({
	component: QueryFailure,
	subcomponents: { QueryPending },
	tags: ["ai-generated"],
	args: { error: new Error("Story request failed"), retry: fn() },
});
export default meta;

export const Failure = meta.story({
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button"));
		await expect(args.retry).toHaveBeenCalledOnce();
	},
});
export const Pending = meta.story({ render: () => <QueryPending /> });
