import { Button } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, waitFor, within } from "storybook/test";

import { withRouter } from "@/stories/decorators/withRouter";
import { AuthModal } from "./AuthModal";

const Wrapper = (args: { initialMode: "login" | "register" }) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open auth</Button>
      <AuthModal
        open={open}
        onClose={() => setOpen(false)}
        initialMode={args.initialMode}
      />
    </>
  );
};

const meta = {
  title: "Domain/User/AuthModal",
  component: Wrapper,
  decorators: [withRouter],
  args: { initialMode: "login" },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { initialMode: "register" },
};

export const HappyPath: Story = {
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument.body;
    const scope = within(root);
    const emailField = await waitFor(() => scope.getByLabelText(/email/i));
    await userEvent.type(emailField, "reader@example.com");
  },
};
