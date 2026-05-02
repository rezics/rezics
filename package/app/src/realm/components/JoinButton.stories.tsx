import type { Meta, StoryObj } from "@storybook/react-vite";

import { JoinButton } from "./JoinButton";

const meta = {
  title: "Domain/Realm/JoinButton",
  component: JoinButton,
  args: { realmId: "realm-default" },
  parameters: {
    docs: {
      description: {
        component:
          "Hooked to the live realm membership query. The story renders an idle button — a real backend / MSW handler is required to exercise the join/leave path.",
      },
    },
  },
} satisfies Meta<typeof JoinButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
