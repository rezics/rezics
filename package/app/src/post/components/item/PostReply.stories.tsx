import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { postFlat } from "@/stories/fixtures/post";
import { PostReply } from "./PostReply";

const Wrapper = (args: { showAvatar?: boolean }) => {
  const post = {
    ...postFlat[0],
    directReplyCount: 3,
  };
  return <PostReply post={post} showAvatar={args.showAvatar} />;
};

const meta = {
  title: "Domain/Post/PostReply",
  component: Wrapper,
  decorators: [withRouter],
  args: { showAvatar: true },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { showAvatar: false },
};
