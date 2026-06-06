import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { OptionalPasswordField } from "./OptionalPasswordField";

interface PreviewArgs {
  helperText?: string;
  note?: string;
  initialValue?: string;
}

function OptionalPasswordFieldPreview({
  helperText,
  note,
  initialValue = "",
}: PreviewArgs) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="max-w-sm">
      <OptionalPasswordField
        value={value}
        setValue={setValue}
        helperText={helperText}
        note={note}
      />
    </div>
  );
}

const meta = {
  title: "Composite/Auth/OptionalPasswordField",
  component: OptionalPasswordFieldPreview,
} satisfies Meta<typeof OptionalPasswordFieldPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithNote: Story = {
  args: {
    note: "We will email you a magic link if you skip setting a password.",
  },
};
