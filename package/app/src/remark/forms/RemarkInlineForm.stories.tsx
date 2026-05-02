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
          "Inline rate-and-remark form. Submission requires the score + post mutations on the live backend; without an MSW handler the submit click is no-op.",
      },
    },
  },
} satisfies Meta<typeof RemarkInlineForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HappyPath: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const remarkField = await waitFor(() =>
      canvas.getByPlaceholderText(/write a short remark/i),
    );
    await userEvent.type(
      remarkField,
      "Compelling middle act, slow finish. Worth a re-read.",
    );
  },
};
