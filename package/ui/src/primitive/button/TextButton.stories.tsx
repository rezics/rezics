import type { Meta, StoryObj } from "@storybook/react-vite";

import { TextButton } from "./TextButton";

const meta = {
  title: "Primitive/Button/TextButton",
  component: TextButton,
  args: {
    children: "View all chapters",
    onClick: () => {},
  },
} satisfies Meta<typeof TextButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Link: Story = { args: { buttonStyle: "link" } };
export const Text: Story = { args: { buttonStyle: "text" } };

export const InParagraph: Story = {
  render: (args) => (
    <p className="max-w-md text-sm text-text-secondary">
      You finished Chapter 4.{" "}
      <TextButton {...args}>Continue reading</TextButton> where you left off, or
      pick a different one.
    </p>
  ),
};
