import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, Bookmark, Library, Settings } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

const meta = {
  title: "Primitives/Sidebar",
  component: Sidebar,
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

function SidebarSample() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="px-2 py-1 text-sm font-semibold">Rezics</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Library</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <Library /> Currently reading
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <BookOpen /> Up next
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Bookmark /> Highlights
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Settings /> Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex items-center gap-2 border-b p-2">
          <SidebarTrigger />
          <span className="text-sm font-medium">Library</span>
        </div>
        <div className="p-4 text-sm text-text-secondary">Page content.</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Default: Story = {
  render: () => (
    <div className="h-[420px] w-full overflow-hidden rounded-md border">
      <SidebarSample />
    </div>
  ),
};

export const WithDensity: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      {(["compact", "comfortable", "spacious"] as const).map((mode) => (
        <div
          key={mode}
          className={`${
            mode === "compact"
              ? "density-compact"
              : mode === "spacious"
                ? "density-spacious"
                : ""
          } space-y-2`}
        >
          <div className="text-xs font-medium capitalize text-text-muted">
            {mode}
          </div>
          <div className="h-[320px] overflow-hidden rounded-md border">
            <SidebarSample />
          </div>
        </div>
      ))}
    </div>
  ),
};
