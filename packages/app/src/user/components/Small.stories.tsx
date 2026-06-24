import type { Meta, StoryObj } from "@storybook/react-vite";

import { Small } from "./Small";

const meta = {
  title: "App/User/Small",
  component: Small.Container,
} satisfies Meta<typeof Small.Container>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="outline outline-black">
      <Small.Container
        id=""
        name=""
        subscriber={1000}
        avatar="https://i.pravatar.cc/300"
      />
    </div>
  ),
};
