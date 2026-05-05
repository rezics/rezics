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
