import type { Meta, StoryObj } from "@storybook/react-vite";

import { CookieConsentBanner } from "./CookieConsentBanner";

const meta = {
  title: "Composite/CookieConsent/CookieConsentBanner",
  component: CookieConsentBanner,
  args: {
    title: "Cookie preferences",
    body: "We use cookies to keep you signed in and to remember your reading preferences.",
    policyLabel: "Privacy policy",
    acceptLabel: "Accept all",
    onAccept: () => undefined,
    onPolicyClick: () => undefined,
  },
} satisfies Meta<typeof CookieConsentBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSecondaryAction: Story = {
  args: {
    secondaryAction: {
      label: "Reject non-essential",
      onClick: () => undefined,
    },
  },
};
