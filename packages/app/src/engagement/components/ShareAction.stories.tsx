import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShareAction } from "./ShareAction";

const meta = {
  title: "App/Engagement/ShareAction",
  component: ShareAction,
} satisfies Meta<typeof ShareAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MdDefault: Story = {
  render: () => (
    <ShareAction
      size="md"
      href="/post/fixture-share-1"
      title="Example post title"
    />
  ),
};

export const SmCompact: Story = {
  render: () => <ShareAction size="sm" href="/post/fixture-share-2" />,
};

export const LgDetailSurface: Story = {
  render: () => (
    <ShareAction
      size="lg"
      href="/post/fixture-share-3"
      title="Long-form detail page"
    />
  ),
};
