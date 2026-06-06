import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { DraftPublishActions } from "./DraftPublishActions";

const meta = {
  title: "App/Drafts/DraftPublishActions",
  component: DraftPublishActions,
  args: {
    onSaveDraft: fn(),
    onPublish: fn(),
  },
} satisfies Meta<typeof DraftPublishActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Save-draft and Publish coexist; each click routes to its own handler. */
export const SaveAndPublish: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // zh-hant default locale: 儲存草稿 / 發佈.
    const save = canvas.getByRole("button", { name: "儲存草稿" });
    const publish = canvas.getByRole("button", { name: "發佈" });

    await userEvent.click(publish);
    expect(args.onPublish).toHaveBeenCalledTimes(1);
    await userEvent.click(save);
    expect(args.onSaveDraft).toHaveBeenCalledTimes(1);
  },
};

/** A pending request disables both actions. */
export const Pending: Story = {
  args: { isPending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "發佈" })).toBeDisabled();
    expect(canvas.getByRole("button", { name: "儲存草稿" })).toBeDisabled();
  },
};

/** A policy denial (e.g. blocked account) renders inline instead of toasting. */
export const Denied: Story = {
  args: { denial: { code: "BLOCKED_ACCOUNT" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("alert")).toBeInTheDocument();
  },
};
