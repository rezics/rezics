import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { remarkList } from "@/stories/fixtures/remark";
import { RemarkList } from "./RemarkList";

const meta = {
  title: "Domain/Remark/RemarkList",
  component: RemarkList,
  decorators: [withRouter],
  args: { posts: remarkList },
} satisfies Meta<typeof RemarkList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { posts: [] },
};
