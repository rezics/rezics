import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { PasswordField } from "./PasswordField";

interface PreviewArgs {
  initialValue?: string;
  required?: boolean;
  helperText?: string;
}

function PasswordFieldPreview({
  initialValue = "",
  required,
  helperText,
}: PreviewArgs) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="max-w-sm">
      <PasswordField
        value={value}
        setValue={setValue}
        required={required}
        helperText={helperText}
      />
    </div>
  );
}

const meta = {
  title: "Composite/Forms/PasswordField",
  component: PasswordFieldPreview,
} satisfies Meta<typeof PasswordFieldPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHelperText: Story = {
  args: {
    helperText: "Use at least 8 characters with a mix of cases.",
    initialValue: "secret",
  },
};
