import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { withRouter } from "@/stories/decorators/withRouter";
import { postLongBody } from "@/stories/fixtures/post";
import { PostFlowCard } from "./PostFlowCard";
import { PostFlowMediaCard } from "./PostFlowMediaCard";

const withCardFrame: Decorator = (Story) => (
  <div className="max-w-[45.75rem] bg-surface-canvas p-4 text-text-primary">
    <Story />
  </div>
);

const meta = {
  title: "App/Components/Card/Flow/PostFlowCard",
  component: PostFlowCard,
  decorators: [withRouter, withCardFrame],
  args: { post: postLongBody },
} satisfies Meta<typeof PostFlowCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSmallMedia: Story = {
  args: {
    title: "A thread title can clamp independently from the body",
    mediaSlot: (
      <div className="h-full w-full bg-surface-sunken" aria-hidden="true" />
    ),
  },
};

export const MediaForward: Story = {
  render: () => (
    <PostFlowMediaCard
      post={postLongBody}
      title="A media-forward post still keeps the reaction bar in the flow"
      onOpen={() => undefined}
      mediaSlot={
        <div className="flex h-full w-full items-center justify-center bg-surface-sunken text-sm text-text-secondary">
          Media
        </div>
      }
    />
  ),
};
