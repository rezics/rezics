import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { SimpleProgress } from "./SimpleProgress";
import { useFakeProgress } from "./useFakeProgress";

function GlobalProgressBarPreview({ active }: { active: boolean }) {
  const [isLoading, setIsLoading] = useState(active);
  const progress = useFakeProgress(isLoading);
  return (
    <div className="space-y-4">
      <SimpleProgress progress={progress} />
      <div className="space-y-2 pt-8">
        <p className="text-sm text-neutral-700">
          The progress bar simulates a navigation tick. Toggle the button to
          start a fresh fake progress run.
        </p>
        <button
          type="button"
          className="rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600"
          onClick={() => setIsLoading((prev) => !prev)}
        >
          {isLoading ? "Stop" : "Start"} navigation
        </button>
      </div>
    </div>
  );
}

const meta = {
  title: "Primitive/Progress/GlobalProgressBar",
  component: GlobalProgressBarPreview,
  args: { active: true },
} satisfies Meta<typeof GlobalProgressBarPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { active: false },
};
