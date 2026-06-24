import type { Meta, StoryObj } from "@storybook/react-vite";

import { ChapterList } from "./ChapterList";

const meta = {
  title: "App/BookLibrary/ChapterList",
  component: ChapterList,
} satisfies Meta<typeof ChapterList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="p-4 w-2xl">
      <ChapterList id="1" />
    </div>
  ),
};
