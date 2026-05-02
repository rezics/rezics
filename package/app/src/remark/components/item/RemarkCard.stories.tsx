import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import {
  remarkCJK,
  remarkLatin,
  remarkLong,
  remarkShort,
} from "@/stories/fixtures/remark";
import { RemarkCard } from "./RemarkCard";

const meta = {
  title: "Domain/Remark/RemarkCard",
  component: RemarkCard,
  decorators: [withRouter],
  args: { remark: remarkShort },
} satisfies Meta<typeof RemarkCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: { remark: remarkLong },
};

export const LocaleCJK: Story = {
  args: { remark: remarkCJK },
};

export const LocaleLatin: Story = {
  args: { remark: remarkLatin },
};
