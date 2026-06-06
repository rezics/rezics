import type { AiDisclosureMode } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { AiDisclosureSelector } from "./AiDisclosureSelector";

function AiDisclosureSelectorPreview({
  value = "UNKNOWN",
  helperText,
}: {
  value?: AiDisclosureMode;
  helperText?: string;
}) {
  const [mode, setMode] = useState<AiDisclosureMode>(value);
  return (
    <div className="w-72">
      <AiDisclosureSelector
        value={mode}
        onChange={setMode}
        helperText={helperText}
      />
    </div>
  );
}

const meta = {
  title: "Composite/Content/AiDisclosureSelector",
  component: AiDisclosureSelectorPreview,
} satisfies Meta<typeof AiDisclosureSelectorPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithHelperText: Story = {
  args: { helperText: "Choose the declared AI involvement for this content." },
};
