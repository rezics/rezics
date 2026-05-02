import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import FullScreenModal from "./FullScreenModal";

function FullScreenModalPreview({ title }: { title: string }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        type="button"
        className="rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600"
        onClick={() => setOpen(true)}
      >
        Open modal
      </button>
      <FullScreenModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
      >
        <Typography variant="body1">
          Full-screen modals carry attention-heavy flows: chapter editors,
          immersive search, or onboarding sheets.
        </Typography>
      </FullScreenModal>
    </>
  );
}

const meta = {
  title: "Composite/Surface/FullScreenModal",
  component: FullScreenModalPreview,
  args: { title: "Compose review" },
} satisfies Meta<typeof FullScreenModalPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
