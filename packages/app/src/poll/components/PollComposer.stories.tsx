import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRouter } from "@/stories/decorators/withRouter";
import { PollComposer } from "./PollComposer";

const meta = {
  title: "App/Poll/PollComposer",
  component: PollComposer,
  decorators: [
    withRouter,
    (Story) => (
      <div className="w-full mx-auto max-w-xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PollComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
