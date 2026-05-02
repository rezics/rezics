import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { postFlat } from "@/stories/fixtures/post";
import { PostAuthorHeader } from "./PostAuthorHeader";

const meta = {
  title: "Domain/Post/PostAuthorHeader",
  component: PostAuthorHeader,
  decorators: [withRouter],
  args: { post: postFlat[0] },
} satisfies Meta<typeof PostAuthorHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { size: "compact" },
};
