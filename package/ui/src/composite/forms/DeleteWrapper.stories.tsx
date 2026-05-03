import type { Meta, StoryObj } from "@storybook/react-vite";

import { DeleteButton, DeleteWrapper } from "./DeleteWrapper";

const meta = {
  title: "Composite/Forms/DeleteWrapper",
  component: DeleteWrapper,
  args: {
    onDelete: () => Promise.resolve(),
  },
} satisfies Meta<typeof DeleteWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DeleteWrapper {...args}>
      <button
        type="button"
        className="rounded-md bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600"
      >
        Delete shelf
      </button>
    </DeleteWrapper>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <DeleteWrapper {...args} disabled>
      <button
        type="button"
        className="rounded-md bg-neutral-300 px-4 py-2 text-sm font-medium text-white"
      >
        Delete shelf
      </button>
    </DeleteWrapper>
  ),
};

export const WithDeleteButton: Story = {
  render: () => (
    <DeleteButton
      onDelete={async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }}
      variant="destructive"
      label="Remove account"
    />
  ),
};
