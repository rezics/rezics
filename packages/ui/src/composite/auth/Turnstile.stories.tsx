import type { Meta, StoryObj } from "@storybook/react-vite";

import { Turnstile } from "./Turnstile";

const meta = {
  title: "Composite/Auth/Turnstile",
  component: Turnstile,
  args: {
    siteKeyProps: "1x00000000000000000000AA",
    onVerify: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Cloudflare Turnstile widget. The story shows the loading fallback because Turnstile loads its script from challenges.cloudflare.com at runtime — provide a valid site key in real environments.",
      },
    },
  },
} satisfies Meta<typeof Turnstile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
