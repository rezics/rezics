import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { RatingInput, type RatingInputProps } from "./RatingInput";

const meta = {
  title: "Primitive/Control/RatingInput",
  component: RatingInput,
  args: {
    value: null,
    max: 5,
    size: "md",
    onChange: () => undefined,
  },
} satisfies Meta<typeof RatingInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample(args: RatingInputProps) {
  const [value, setValue] = useState<number | null>(args.value ?? null);
  return <RatingInput {...args} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: (args) => <ControlledExample {...args} />,
};

export const PreFilled: Story = {
  args: { value: 3, max: 5 },
  render: (args) => <ControlledExample {...args} />,
};

export const ReadOnly: Story = {
  args: { value: 4, max: 5, readOnly: true },
  render: (args) => <ControlledExample {...args} />,
};

export const Disabled: Story = {
  args: { value: 2, max: 5, disabled: true },
  render: (args) => <ControlledExample {...args} />,
};

export const Small: Story = {
  args: { value: 3, max: 5, size: "sm" },
  render: (args) => <ControlledExample {...args} />,
};

export const Medium: Story = {
  args: { value: 3, max: 5, size: "md" },
  render: (args) => <ControlledExample {...args} />,
};

export const Large: Story = {
  args: { value: 3, max: 5, size: "lg" },
  render: (args) => <ControlledExample {...args} />,
};

export const Max5: Story = {
  args: { value: 3, max: 5 },
  render: (args) => <ControlledExample {...args} />,
};

export const Max10: Story = {
  args: { value: 7, max: 10 },
  render: (args) => <ControlledExample {...args} />,
};
