import type { Meta, StoryObj } from "@storybook/react-vite";
import { AiDisclosureBadge } from "./AiDisclosureBadge";

const meta = {
  title: "Composite/Content/AiDisclosureBadge",
  component: AiDisclosureBadge,
  args: { mode: "UNKNOWN" },
} satisfies Meta<typeof AiDisclosureBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unknown: Story = {};
export const NoAiUse: Story = { args: { mode: "NONE" } };
export const Assisted: Story = { args: { mode: "AI_ASSISTED" } };
export const Originated: Story = { args: { mode: "AI_ORIGINATED" } };
export const MachineGenerated: Story = {
  args: { mode: "MACHINE_GENERATED" },
};
