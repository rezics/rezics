import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import {
  postCJK,
  postEmpty,
  postFlat,
  postLatin,
  postLongBody,
} from "@/stories/fixtures/post";
import { PostCard } from "./PostCard";

const meta = {
  title: "Domain/Post/PostCard",
  component: PostCard,
  decorators: [withRouter],
  args: { post: postFlat[0] },
} satisfies Meta<typeof PostCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: { post: postLongBody },
};

export const Empty: Story = {
  args: { post: postEmpty },
};

export const LocaleCJK: Story = {
  args: { post: postCJK },
};

export const LocaleLatin: Story = {
  args: { post: postLatin },
};
