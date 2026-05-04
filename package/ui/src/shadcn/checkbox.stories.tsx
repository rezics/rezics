import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta = {
  title: "Primitives/Checkbox",
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="cb-default" />
      <Label htmlFor="cb-default">Mark as read</Label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="cb-checked" defaultChecked />
      <Label htmlFor="cb-checked">Email me when ready</Label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox id="cb-d1" disabled />
        <Label htmlFor="cb-d1">Disabled, unchecked</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="cb-d2" disabled defaultChecked />
        <Label htmlFor="cb-d2">Disabled, checked</Label>
      </div>
    </div>
  ),
};
