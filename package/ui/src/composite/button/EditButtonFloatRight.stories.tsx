import type { Meta, StoryObj } from "@storybook/react-vite";

import { EditButtonFloatRightContainer } from "./EditButtonFloatRight";

const meta = {
  title: "Composite/Button/EditButtonFloatRight",
  component: EditButtonFloatRightContainer,
  args: { onClick: () => console.log("Edit clicked"), text: "编辑" },
  decorators: [
    (Story) => (
      <div className="p-4 border border-gray-200 rounded">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EditButtonFloatRightContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomText: Story = {
  args: { onClick: () => console.log("Modify clicked"), text: "修改" },
};
