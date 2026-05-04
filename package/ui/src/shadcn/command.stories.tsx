import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, Bookmark, Library, Search, Settings } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

const meta = {
  title: "Primitives/Command",
  component: Command,
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

function CommandSample() {
  return (
    <Command className="w-80 rounded-md border shadow-md">
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Library">
          <CommandItem>
            <Library /> Open library
            <CommandShortcut>⌘L</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <BookOpen /> Resume reading
          </CommandItem>
          <CommandItem>
            <Bookmark /> View bookmarks
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Other">
          <CommandItem>
            <Search /> Search annotations
          </CommandItem>
          <CommandItem>
            <Settings /> Preferences
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

export const Default: Story = {
  render: () => <CommandSample />,
};

export const WithDensity: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <div className="density-compact space-y-2">
        <div className="text-xs font-medium text-text-muted">Compact</div>
        <CommandSample />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-text-muted">Comfortable</div>
        <CommandSample />
      </div>
      <div className="density-spacious space-y-2">
        <div className="text-xs font-medium text-text-muted">Spacious</div>
        <CommandSample />
      </div>
    </div>
  ),
};
