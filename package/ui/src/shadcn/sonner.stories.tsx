import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";

import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = {
  title: "Primitives/Sonner",
  component: Toaster,
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Toaster />
      <Button onClick={() => toast("Saved")}>Default</Button>
      <Button onClick={() => toast.success("Highlight saved")} variant="secondary">
        Success
      </Button>
      <Button onClick={() => toast.info("New chapter unlocked")} variant="outline">
        Info
      </Button>
      <Button onClick={() => toast.warning("Storage almost full")} variant="outline">
        Warning
      </Button>
      <Button onClick={() => toast.error("Sync failed")} variant="destructive">
        Error
      </Button>
    </div>
  ),
};
