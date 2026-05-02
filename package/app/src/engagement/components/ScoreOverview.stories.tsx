import type { Meta, StoryObj } from "@storybook/react-vite";

import { ScoreOverview } from "./ScoreOverview";

const meta = {
  title: "Domain/Engagement/ScoreOverview",
  component: ScoreOverview,
  args: { unitId: "book-quiet-library" },
  parameters: {
    docs: {
      description: {
        component:
          "Pulls aggregate rating data through the score API. Without a backend / MSW handler the story falls back to the empty state.",
      },
    },
  },
} satisfies Meta<typeof ScoreOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { unitId: "book-without-ratings" },
};
