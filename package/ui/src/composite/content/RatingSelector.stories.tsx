import type { ContentRating } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { RatingSelector } from "./RatingSelector";

interface PreviewArgs {
  initialValue?: ContentRating;
  helperText?: string;
  disabled?: boolean;
}

function RatingSelectorPreview({
  initialValue = "GENERAL",
  helperText,
  disabled,
}: PreviewArgs) {
  const [value, setValue] = useState<ContentRating>(initialValue);
  return (
    <div className="max-w-xs">
      <RatingSelector
        value={value}
        onChange={setValue}
        helperText={helperText}
        disabled={disabled}
      />
    </div>
  );
}

const meta = {
  title: "Composite/Content/RatingSelector",
  component: RatingSelectorPreview,
  args: { initialValue: "GENERAL" },
} satisfies Meta<typeof RatingSelectorPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHelperText: Story = {
  args: { helperText: "Choose the rating that matches your work." },
};

export const Disabled: Story = {
  args: { disabled: true, initialValue: "R_15" },
};
