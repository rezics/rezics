import { Box } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ReplyComposer } from "./ReplyComposer";

const meta = {
  title: "App/Post/ReplyComposer",
  component: ReplyComposer,
} satisfies Meta<typeof ReplyComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProgressiveEmpty: Story = {
  render: () => (
    <Box p={2}>
      <ReplyComposer
        mode="progressive"
        targetUnitId="fixture-target-1"
        placeholder="Start a discussion"
      />
    </Box>
  ),
};

export const ProgressiveAutoFocus: Story = {
  render: () => (
    <Box p={2}>
      <ReplyComposer
        mode="progressive"
        autoFocus
        targetUnitId="fixture-target-2"
      />
    </Box>
  ),
};

export const ExpandedInlineReply: Story = {
  render: () => (
    <Box p={2}>
      <ReplyComposer
        mode="expanded"
        targetUnitId="fixture-target-3"
        parentPostUnitId="fixture-parent-3"
      />
    </Box>
  ),
};
