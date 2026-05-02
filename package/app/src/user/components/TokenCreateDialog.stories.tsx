import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { TokenCreateDialog } from "./TokenCreateDialog";

const Wrapper = () => {
  const [open, setOpen] = useState(true);
  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border p-2"
        >
          Open dialog
        </button>
      )}
      <TokenCreateDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
};

const meta = {
  title: "Domain/User/TokenCreateDialog",
  component: Wrapper,
  parameters: {
    docs: {
      description: {
        component:
          "Generates an API token via `useCreateTokenMutation`. The submit path requires an authenticated session and a running server, so the `HappyPath` story only exercises form interaction up to the create step.",
      },
    },
  },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
