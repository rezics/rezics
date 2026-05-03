import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, waitFor, within } from "storybook/test";

import { RemarkInlineForm } from "./RemarkInlineForm";

const meta = {
  title: "Domain/Remark/RemarkInlineForm",
  component: RemarkInlineForm,
  args: { bookUnitId: "book-quiet-library" },
  parameters: {
    docs: {
      description: {
        component:
          "Progressive remark composer: collapsed line expands to a full Markdown editor on focus. Submit requires the post mutation on the live backend; without an MSW handler the submit click is a no-op.",
      },
    },
  },
} satisfies Meta<typeof RemarkInlineForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await waitFor(() =>
      canvas.getByPlaceholderText(/短評|remark/i),
    );
    await userEvent.click(trigger);
  },
};
