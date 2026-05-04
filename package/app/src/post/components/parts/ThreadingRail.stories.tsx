import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ThreadingHoverProvider } from "./ThreadingContext";
import { ThreadingRail } from "./ThreadingRail";

function Row({ initialCollapsed = false }: { initialCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  return (
    <ThreadingHoverProvider>
      <div className="relative pl-10 py-12 h-[120px]">
        <ThreadingRail
          leftPx={30}
          isCollapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
        <div className="text-text-secondary">
          Hover the 12 px rail zone to see the stroke highlight.
        </div>
      </div>
    </ThreadingHoverProvider>
  );
}

const meta = {
  title: "App/Post/ThreadingRail",
  component: ThreadingRail,
} satisfies Meta<typeof ThreadingRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExpandedRow: Story = {
  render: () => <Row initialCollapsed={false} />,
};

export const CollapsedRow: Story = {
  render: () => <Row initialCollapsed />,
};
