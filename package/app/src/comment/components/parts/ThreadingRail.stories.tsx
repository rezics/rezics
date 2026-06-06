import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { CollapseToggle } from "./CollapseToggle";
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
          toggleSlot={
            <CollapseToggle
              isCollapsed={collapsed}
              onToggle={() => setCollapsed((c) => !c)}
            />
          }
        />
        <div className="text-text-secondary">
          Hover the rail gutter to see the CSS line highlight.
        </div>
      </div>
    </ThreadingHoverProvider>
  );
}

const meta = {
  title: "App/Comment/ThreadingRail",
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

export const RoundedElbowContinuation: Story = {
  render: () => (
    <ThreadingHoverProvider>
      <div className="relative h-[160px] pl-24 py-8">
        <ThreadingRail
          leftPx={30}
          elbowWidthPx={64}
          elbowTopPx={22}
          continuesAfterElbow
          onToggleCollapse={() => undefined}
        />
        <div className="text-sm text-text-secondary">
          Border-radius branch with a continuing ancestor rail.
        </div>
      </div>
    </ThreadingHoverProvider>
  ),
};

export const LongRoundedElbowContinuation: Story = {
  render: () => (
    <ThreadingHoverProvider>
      <div className="relative h-[360px] pl-24 py-8">
        <ThreadingRail
          leftPx={30}
          elbowWidthPx={64}
          elbowTopPx={22}
          continuesAfterElbow
          onToggleCollapse={() => undefined}
        />
        <div className="text-sm text-text-secondary">
          Long ancestor rail with a rounded CSS branch.
        </div>
      </div>
    </ThreadingHoverProvider>
  ),
};

export const StackedRowContinuation: Story = {
  render: () => (
    <ThreadingHoverProvider>
      <div className="pl-24 py-8">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="relative h-[72px]">
            <ThreadingRail
              leftPx={30}
              elbowWidthPx={row === 1 ? 64 : 0}
              elbowTopPx={22}
              continuesAfterElbow={row === 1}
              onToggleCollapse={() => undefined}
            />
            <div className="text-sm text-text-secondary">Row {row + 1}</div>
          </div>
        ))}
      </div>
    </ThreadingHoverProvider>
  ),
};
