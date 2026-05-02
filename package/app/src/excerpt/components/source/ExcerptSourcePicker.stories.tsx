import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import type { ExcerptSource } from "@rezics/contract";
import { ExcerptSourcePicker } from "./ExcerptSourcePicker";

const Wrapper = (args: {
  initial?: ExcerptSource;
  disabled?: boolean;
  error?: string;
}) => {
  const [value, setValue] = useState<ExcerptSource | undefined>(args.initial);
  return (
    <ExcerptSourcePicker
      value={value}
      onChange={setValue}
      disabled={args.disabled}
      error={args.error}
    />
  );
};

const meta = {
  title: "Domain/Excerpt/ExcerptSourcePicker",
  component: Wrapper,
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: { error: "Source URL is required" },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    initial: {
      mode: "url",
      url: "https://example.com/articles/quiet-library",
      title: "On quiet libraries",
    },
  },
};
