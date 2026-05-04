import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Primitives/Dialog",
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Edit shelf</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename shelf</DialogTitle>
          <DialogDescription>
            Give this shelf a name your future self will recognize.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label htmlFor="dialog-name">Name</Label>
          <Input id="dialog-name" defaultValue="Currently reading" />
        </div>
        <DialogFooter showCloseButton>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
