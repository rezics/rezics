import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import DialogContainer from "./DialogContainer";

interface PreviewArgs {
  title?: string;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  fullScreen?: boolean;
}

function DialogContainerPreview({
  title = "Settings",
  maxWidth = "md",
  fullScreen = false,
}: PreviewArgs) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        type="button"
        className="rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600"
        onClick={() => setOpen(true)}
      >
        Open dialog
      </button>
      <DialogContainer
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        maxWidth={maxWidth}
        fullScreen={fullScreen}
      >
        <p className="text-base">
          Dialog body content. Press <kbd>Esc</kbd> or use the close button to
          dismiss.
        </p>
      </DialogContainer>
    </>
  );
}

const meta = {
  title: "Composite/Surface/DialogContainer",
  component: DialogContainerPreview,
  args: { title: "Settings", maxWidth: "md" },
} satisfies Meta<typeof DialogContainerPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { maxWidth: "xs" },
};

export const FullScreen: Story = {
  args: { fullScreen: true },
};
