import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "./context-menu";

const meta = {
  title: "Primitives/ContextMenu",
  component: ContextMenu,
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

function ContextMenuSample() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-32 w-64 items-center justify-center rounded-md border border-dashed text-sm text-text-muted">
        Right-click here
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>Chapter</ContextMenuLabel>
        <ContextMenuItem>
          Mark as read <ContextMenuShortcut>⌘R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>Add bookmark</ContextMenuItem>
        <ContextMenuItem variant="destructive">Remove highlight</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem checked>Show notes</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuRadioGroup value="serif">
          <ContextMenuLabel>Typeface</ContextMenuLabel>
          <ContextMenuRadioItem value="serif">Serif</ContextMenuRadioItem>
          <ContextMenuRadioItem value="sans">Sans</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const Default: Story = {
  render: () => <ContextMenuSample />,
};

export const WithDensity: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <div className="density-compact space-y-2">
        <div className="text-xs font-medium text-text-muted">Compact</div>
        <ContextMenuSample />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-text-muted">Comfortable</div>
        <ContextMenuSample />
      </div>
      <div className="density-spacious space-y-2">
        <div className="text-xs font-medium text-text-muted">Spacious</div>
        <ContextMenuSample />
      </div>
    </div>
  ),
};
