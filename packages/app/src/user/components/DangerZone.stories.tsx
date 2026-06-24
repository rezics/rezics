import { Button } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { DangerZone } from "./DangerZone";

const meta = {
  title: "Domain/User/DangerZone",
  component: DangerZone,
  args: {
    title: "Danger Zone",
    description: "These actions cannot be undone.",
    children: (
      <Button variant="outline" className="text-error-text">
        Delete account
      </Button>
    ),
  },
} satisfies Meta<typeof DangerZone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
