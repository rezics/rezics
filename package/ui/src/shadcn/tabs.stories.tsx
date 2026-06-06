import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function TabsSample({ variant = "default" }: { variant?: "default" | "line" }) {
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
