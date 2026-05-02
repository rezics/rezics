import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShadowRoundedCard } from "./Card";

const meta = {
  title: "Primitive/Card/ShadowRoundedCard",
  component: ShadowRoundedCard,
  args: {
    children: "Card content",
  },
} satisfies Meta<typeof ShadowRoundedCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: {
    children: (
      <div className="space-y-3">
        <h3 className="text-xl font-semibold">Card title</h3>
        <p className="text-sm text-neutral-700">
          The shadow rounded card frames any block of content with a soft
          rose-tinted backdrop. Use it to call out high-importance summaries or
          to separate a primary call-to-action from the surrounding page.
        </p>
        <p className="text-sm text-neutral-700">
          Long content stays comfortable inside the rounded shell because the
          padding and shadow are tuned to the brand foundation tokens.
        </p>
      </div>
    ),
  },
};
