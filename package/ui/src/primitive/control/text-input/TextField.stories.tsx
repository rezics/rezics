import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { RoseTextField } from "./TextField";

interface ControlledArgs {
  type: string;
  label: string;
  multiline?: boolean;
  rows?: number;
  initialValue?: string;
}

function ControlledRoseTextField({
  initialValue = "",
  ...rest
}: ControlledArgs) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="max-w-sm">
      <RoseTextField
        {...rest}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}

const meta = {
  title: "Primitive/Control/RoseTextField",
  component: ControlledRoseTextField,
  args: {
    type: "text",
    label: "Display name",
  },
} satisfies Meta<typeof ControlledRoseTextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Multiline: Story = {
  args: {
    label: "About you",
    multiline: true,
    rows: 4,
    initialValue: "Tell readers a little about yourself…",
  },
};

export const WithError: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.initialValue ?? "invalid email");
    return (
      <div className="max-w-sm">
        <RoseTextField
          type={args.type}
          label={args.label}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          InputProps={{ error: true, helperText: "Enter a valid email" }}
        />
      </div>
    );
  },
  args: {
    type: "email",
    label: "Email",
    initialValue: "not-an-email",
  },
};

export const Disabled: Story = {
  render: (args) => (
    <div className="max-w-sm">
      <RoseTextField
        type={args.type}
        label={args.label}
        value="readonly value"
        onChange={() => undefined}
        InputProps={{ disabled: true }}
      />
    </div>
  ),
};
