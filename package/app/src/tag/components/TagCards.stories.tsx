import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { TagCard, TagDetailCard } from "./TagCards";

const tag = {
  unitId: "tag-fiction",
  unitType: "BOOK",
  tagUnitId: "fiction",
  score: 1840,
  voteCount: 312,
} as never;

const Wrapper = (args: {
  variant: "card" | "detail";
  selected?: boolean;
}) => {
  if (args.variant === "detail") {
    return <TagDetailCard tag={tag} />;
  }
  return <TagCard tag={tag} selected={args.selected} />;
};

const meta = {
  title: "Domain/Tag/TagCards",
  component: Wrapper,
  decorators: [withRouter],
  args: { variant: "card" },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { variant: "card", selected: true },
};

export const Hero: Story = {
  args: { variant: "detail" },
};
