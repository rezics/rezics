import type { Meta, StoryObj } from "@storybook/react-vite";

import { DeleteButton, DeleteWrapper } from "./DeleteWrapper";

const deleteButton = (
  <button
    type="button"
    className="rounded-md bg-error-fill px-4 py-2 text-sm font-medium text-destructive-foreground"
  >
    Delete shelf
  </button>
);

const meta = {
  title: "Composite/Forms/DeleteWrapper",
  component: DeleteWrapper,
  args: {
    children: deleteButton,
    onDelete: () => Promise.resolve(),
  },
} satisfies Meta<typeof DeleteWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <DeleteWrapper {...args} />,
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => <DeleteWrapper {...args} />,
};

export const WithDeleteButton: Story = {
  args: {
    children: deleteButton,
  },
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
