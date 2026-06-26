import type { Meta, StoryObj } from "@storybook/react-vite";

import { TextLink } from "./TextLink";

interface TextLinkPreviewProps {
  to: string;
  label: string;
}

function TextLinkPreview({ to, label }: TextLinkPreviewProps) {
  return (
    <div className="space-y-3">
      <TextLink to={to} underline="hover">
        {label}
      </TextLink>
    </div>
  );
}

const meta = {
  title: "Primitive/Link/TextLink",
  component: TextLinkPreview,
  args: { to: "/", label: "Open author profile" },
} satisfies Meta<typeof TextLinkPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
