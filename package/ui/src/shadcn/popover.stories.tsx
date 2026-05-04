import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";

const meta = {
  title: "Primitives/Popover",
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent className="grid gap-3">
        <PopoverHeader>
          <PopoverTitle>Reading session</PopoverTitle>
          <PopoverDescription>Set a target for tonight.</PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-2">
          <Label htmlFor="pages">Pages</Label>
          <Input id="pages" defaultValue="20" />
        </div>
      </PopoverContent>
    </Popover>
  ),
};
