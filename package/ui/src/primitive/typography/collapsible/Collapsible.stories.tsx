import type { Meta, StoryObj } from "@storybook/react-vite";

import { Collapsible } from "./Collapsible";

const SHORT_TEXT =
  "This summary fits comfortably inside a couple of lines so the toggle stays hidden.";

const LONG_TEXT = `Reading is a quiet conversation that stretches across centuries, and the best summaries
invite a reader to step into that conversation rather than reciting it line by line. The
collapsible primitive trims long passages to a manageable height while keeping the option to
expand for the full reflection. Use it for review excerpts, book descriptions, and any other
long-form prose that should respect a card's vertical rhythm. The fade variant softens the
boundary between visible and hidden text so the cut never feels abrupt.`;

const meta = {
  title: "Primitive/Typography/Collapsible",
  component: Collapsible,
  args: {
    maxLines: 3,
    children: LONG_TEXT,
  },
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: {
    maxLines: 4,
    fade: true,
    children: `${LONG_TEXT}\n\n${LONG_TEXT}`,
  },
};

export const Empty: Story = {
  args: {
    maxLines: 3,
    children: SHORT_TEXT,
  },
};
