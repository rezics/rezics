import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function TabsSample({
  variant = "default",
}: {
  variant?: "default" | "line";
}) {
  return (
    <Tabs defaultValue="reading" className="w-96">
      <TabsList variant={variant}>
        <TabsTrigger value="reading">Reading</TabsTrigger>
        <TabsTrigger value="finished">Finished</TabsTrigger>
        <TabsTrigger value="archive">Archive</TabsTrigger>
      </TabsList>
      <TabsContent value="reading" className="text-sm text-text-secondary">
        Currently reading: 4 books
      </TabsContent>
      <TabsContent value="finished" className="text-sm text-text-secondary">
        Finished this year: 23 books
      </TabsContent>
      <TabsContent value="archive" className="text-sm text-text-secondary">
        Archived shelves: 6
      </TabsContent>
    </Tabs>
  );
}

export const Default: Story = {
  render: () => <TabsSample />,
};

export const Line: Story = {
  render: () => <TabsSample variant="line" />,
};

export const WithDensity: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <div className="density-compact space-y-2">
        <div className="text-xs font-medium text-text-muted">Compact</div>
        <TabsSample />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-text-muted">Comfortable</div>
        <TabsSample />
      </div>
      <div className="density-spacious space-y-2">
        <div className="text-xs font-medium text-text-muted">Spacious</div>
        <TabsSample />
      </div>
    </div>
  ),
};
