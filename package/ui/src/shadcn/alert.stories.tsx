import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertCircle, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta = {
  title: "Primitives/Alert",
  component: Alert,
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert>
      <Info />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>
        This is a default alert. The icon, title, and description sit on a quiet
        surface tone.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Could not save</AlertTitle>
      <AlertDescription>
        Your changes were not persisted. Try again.
      </AlertDescription>
    </Alert>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Saved.</AlertTitle>
    </Alert>
  ),
};
