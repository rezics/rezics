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

/**
 * Save-draft and Publish coexist; each click routes to its own handler.
 * 保存草稿与发布并存；每次点击都路由到各自的处理函数。
 */
export const SaveAndPublish: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // zh-hant default locale: 儲存草稿 / 發佈.
    // zh-hant 默认语言环境：儲存草稿 / 發佈。
    const save = canvas.getByRole("button", { name: "儲存草稿" });
    const publish = canvas.getByRole("button", { name: "發佈" });

    await userEvent.click(publish);
    expect(args.onPublish).toHaveBeenCalledTimes(1);
    await userEvent.click(save);
    expect(args.onSaveDraft).toHaveBeenCalledTimes(1);
  },
};

/**
 * A pending request disables both actions.
 * 请求进行中时禁用两个操作。
 */
export const Pending: Story = {
  args: { isPending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("button", { name: "發佈" })).toBeDisabled();
    expect(canvas.getByRole("button", { name: "儲存草稿" })).toBeDisabled();
  },
};

/**
 * A policy denial (e.g. blocked account) renders inline instead of toasting.
 * 策略拒绝（如账户被封）以内联方式渲染，而非弹出 toast 提示。
 */
export const Denied: Story = {
  args: { denial: { code: "BLOCKED_ACCOUNT" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("alert")).toBeInTheDocument();
  },
};
