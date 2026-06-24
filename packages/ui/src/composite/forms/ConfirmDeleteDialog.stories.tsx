import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

function ConfirmDeleteDialogPreview() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        type="button"
        className="rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600"
        onClick={() => setOpen(true)}
      >
        Trigger delete
      </button>
      <ConfirmDeleteDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={() => setOpen(false)}
      />
    </>
  );
}

const meta = {
  title: "Composite/Forms/ConfirmDeleteDialog",
  component: ConfirmDeleteDialogPreview,
} satisfies Meta<typeof ConfirmDeleteDialogPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
