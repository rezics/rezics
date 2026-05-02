import GoogleIcon from "@mui/icons-material/Google";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AuthProviderButton } from "./AuthProviderButton";

const meta = {
  title: "Composite/Auth/AuthProviderButton",
  component: AuthProviderButton,
  args: {
    label: "Continue with Google",
    icon: <GoogleIcon fontSize="small" />,
    onClick: () => undefined,
  },
} satisfies Meta<typeof AuthProviderButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { compact: true },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};
