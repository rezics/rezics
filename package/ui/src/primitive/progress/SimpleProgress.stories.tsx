import type { Meta, StoryObj } from "@storybook/react-vite";

import { SimpleProgress } from "./SimpleProgress";

function SimpleProgressPreview({ progress }: { progress: number }) {
  return (
    <div className="relative h-24 w-[480px] rounded-xl bg-neutral-100">
      <SimpleProgress progress={progress} />
      <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
        progress = {progress}
      </div>
    </div>
  );
}

const meta = {
  title: "Primitive/Progress/SimpleProgress",
  component: SimpleProgressPreview,
  args: { progress: 0.4 },
} satisfies Meta<typeof SimpleProgressPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { progress: 0 },
};

export const Loading: Story = {
  args: { progress: 0.7 },
};
