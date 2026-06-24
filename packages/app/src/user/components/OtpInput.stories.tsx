import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";

import { OtpInput } from "./OtpInput";

const Wrapper = (args: {
  length?: number;
  initial?: string;
  disabled?: boolean;
}) => {
  const [value, setValue] = useState(args.initial ?? "");
  return (
    <OtpInput
      length={args.length ?? 6}
      value={value}
      onChange={setValue}
      disabled={args.disabled}
    />
  );
};

const meta = {
  title: "Domain/User/OtpInput",
  component: Wrapper,
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { length: 4 },
};

export const Disabled: Story = {
  args: { initial: "123456", disabled: true },
};

export const HappyPath: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inputs = canvas.getAllByRole("textbox");
    const code = "654321";
    for (let i = 0; i < Math.min(inputs.length, code.length); i += 1) {
      await userEvent.type(inputs[i] as HTMLElement, code[i]);
    }
  },
};
