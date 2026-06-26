import type { Meta, StoryObj } from "@storybook/react-vite";

import { Link } from "./Link";

interface LinkPreviewProps {
  to: string;
  label: string;
}

function LinkPreview({ to, label }: LinkPreviewProps) {
  return (
    <div className="space-y-3">
      <Link to={to} className="text-link hover:underline">
        {label}
      </Link>
    </div>
  );
}

const meta = {
  title: "Primitive/Link/Link",
  component: LinkPreview,
  args: { to: "/", label: "Browse the library" },
} satisfies Meta<typeof LinkPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
