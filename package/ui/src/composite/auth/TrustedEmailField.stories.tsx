import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { TrustedEmailField } from "./TrustedEmailField";

interface PreviewArgs {
  initialLocked?: boolean;
  initialValue?: string;
}

function TrustedEmailFieldPreview({
  initialLocked = true,
  initialValue = "alice@example.com",
}: PreviewArgs) {
  const [value, setValue] = useState(initialValue);
  const [locked, setLocked] = useState(initialLocked);
  return (
    <div className="max-w-sm">
      <TrustedEmailField
        value={value}
        locked={locked}
        onChange={setValue}
        onUnlock={() => setLocked(false)}
        lockedHelperText="Verified email — unlock to change"
        editableHelperText="A verification email will be sent to confirm the change"
      />
    </div>
  );
}

const meta = {
  title: "Composite/Auth/TrustedEmailField",
  component: TrustedEmailFieldPreview,
} satisfies Meta<typeof TrustedEmailFieldPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Editable: Story = {
  args: { initialLocked: false },
};
