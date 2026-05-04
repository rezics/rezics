import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "Primitives/DropdownMenu",
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

function DropdownSample() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>My account</DropdownMenuLabel>
        <DropdownMenuItem>
          Profile <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>
          Show keyboard shortcuts
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value="comfortable">
          <DropdownMenuLabel>Density</DropdownMenuLabel>
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comfortable">
            Comfortable
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="spacious">
            Spacious
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Default: Story = {
  render: () => <DropdownSample />,
};

export const WithDensity: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <div className="density-compact space-y-2">
        <div className="text-xs font-medium text-text-muted">Compact</div>
        <DropdownSample />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-text-muted">Comfortable</div>
        <DropdownSample />
      </div>
      <div className="density-spacious space-y-2">
        <div className="text-xs font-medium text-text-muted">Spacious</div>
        <DropdownSample />
      </div>
    </div>
  ),
};
