import type { Meta, StoryObj } from "@storybook/react-vite";

import { SocialAuthButtons } from "./SocialAuthButtons";

const meta = {
  title: "Domain/User/SocialAuthButtons",
  component: SocialAuthButtons,
  args: { mode: "login" },
  parameters: {
    docs: {
      description: {
        component:
          "Reads the auth provider list from `authQueries.providers`. Without backend / MSW the story renders the optimistic Google fallback.",
      },
    },
  },
} satisfies Meta<typeof SocialAuthButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { mode: "register" },
};
