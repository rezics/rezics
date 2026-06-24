import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { tagLongList, tagShortList } from "@/stories/fixtures/tag";
import { TagList } from "./TagList";

const toUnitTag = (t: { unitId: string }) => ({
  unitId: t.unitId,
  unitType: "BOOK",
  tagUnitId: t.unitId,
  score: 100,
  voteCount: 12,
});

const meta = {
  title: "Domain/Tag/TagList",
  component: TagList,
  decorators: [withRouter],
  args: {
    tags: tagShortList.map(toUnitTag) as never,
  },
} satisfies Meta<typeof TagList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { tags: [] },
};

export const Large: Story = {
  args: { tags: tagLongList.map(toUnitTag) as never },
};
