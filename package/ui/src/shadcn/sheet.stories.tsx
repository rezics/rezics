import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta = {
  title: "Primitives/Sheet",
  component: Sheet,
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function SheetSample({ side }: { side: "right" | "left" | "top" | "bottom" }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open {side}</Button>
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Update your reading preferences and shelves.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 py-2 text-sm text-text-secondary">Body</div>
        <SheetFooter>
          <Button>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export const Right: Story = { render: () => <SheetSample side="right" /> };
export const Left: Story = { render: () => <SheetSample side="left" /> };
export const Top: Story = { render: () => <SheetSample side="top" /> };
export const Bottom: Story = { render: () => <SheetSample side="bottom" /> };
