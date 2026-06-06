import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { CollapseToggle } from "./CollapseToggle";
import { ThreadingHoverProvider } from "./ThreadingContext";

const Wrapper = ({ initial = false }: { initial?: boolean }) => {
  const [collapsed, setCollapsed] = useState(initial);
  return (
    <ThreadingHoverProvider>
      <CollapseToggle
        isCollapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
    </ThreadingHoverProvider>
  );
};

const meta = {
  title: "Domain/Comment/CollapseToggle",
  component: Wrapper,
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { initial: true },
};
