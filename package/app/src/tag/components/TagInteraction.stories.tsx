import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { tagShortList } from "@/stories/fixtures/tag";
import { TagInteraction } from "./TagInteraction";

const tags = tagShortList.map((t) => ({
  unitId: t.unitId,
  unitType: "BOOK",
  tagUnitId: t.unitId,
  score: t.count,
  voteCount: Math.round(t.count / 4),
})) as never;

const translations = Object.fromEntries(
  tagShortList.map((t) => [
    t.unitId,
    {
      tagUnitId: t.unitId,
      name: t.name,
      slug: t.slug,
      description: `${t.name} discussion thread.`,
    },
  ]),
) as never;

const meta = {
  title: "Domain/Tag/TagInteraction",
  component: TagInteraction,
  decorators: [withRouter],
  args: {
    tags,
    translations,
    bookUnitId: "book-quiet-library",
  },
} satisfies Meta<typeof TagInteraction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { tags: [], translations: {} as never },
};
