import { Box } from "@mui/material";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { ReplyComposer } from "./ReplyComposer";

const meta = {
  title: "App/Post/ReplyComposer",
  component: ReplyComposer,
  parameters: {
    docs: {
      description: {
        component:
          "Inline composer used by `PostTreeSection` and `ShelfDiscussionSection`. The submit step calls `useCreatePostMutation`; without an MSW handler the network call rejects, so the `HappyPath` play stops after the body is typed and the editor reports it.",
      },
    },
  },
} satisfies Meta<typeof ReplyComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
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

export const Compact: Story = {
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

export const Empty: Story = {
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

export const HappyPath: Story = {
  render: () => (
    <Box p={2}>
      <ReplyComposer
        mode="progressive"
        targetUnitId="fixture-target-happy"
        placeholder="Start a discussion"
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByPlaceholderText(/start a discussion/i);
    await userEvent.click(trigger);
    await waitFor(() => {
      const editor = canvasElement.querySelector<HTMLElement>(
        "textarea, [contenteditable='true']",
      );
      expect(editor).not.toBeNull();
    });
    const editor = canvasElement.querySelector<HTMLElement>(
      "textarea, [contenteditable='true']",
    );
    if (editor) {
      editor.focus();
      await userEvent.keyboard("Looks good!");
    }
  },
};
