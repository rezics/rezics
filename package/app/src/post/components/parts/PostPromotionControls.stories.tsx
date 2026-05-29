import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { PostPromotionControls } from "./PostPromotionControls";

/**
 * The controls render as overflow-menu entries; the stories show them inside an
 * always-open dropdown so the entries are visible for review. In the app they
 * are injected through `renderOverflowContent` into the reply `ReactionBar`.
 */
const noop = () => undefined;

const Frame = (props: React.ComponentProps<typeof PostPromotionControls>) => (
  <DropdownMenu open>
    <DropdownMenuTrigger>Overflow</DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <PostPromotionControls {...props} />
    </DropdownMenuContent>
  </DropdownMenu>
);

const meta = {
  title: "Domain/Post/PostPromotionControls",
  component: Frame,
  args: {
    pinKind: null,
    canPin: true,
    canAccept: true,
    onPin: noop,
    onUnpin: noop,
    onAccept: noop,
    onUnaccept: noop,
  },
} satisfies Meta<typeof Frame>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Unpromoted, direct reply of a question thread: Pin and Accept offered. */
export const PinAndAccept: Story = {};

/** Non-question thread: only Pin is offered. */
export const PinOnly: Story = {
  args: { canAccept: false },
};

/** Pinned reply: only Unpin is offered. */
export const Pinned: Story = {
  args: { pinKind: "PINNED" },
};

/** Accepted answer: only Unaccept is offered. */
export const Accepted: Story = {
  args: { pinKind: "ACCEPTED_ANSWER" },
};

/** Viewer without authority: no entries render. */
export const NoControls: Story = {
  args: { canPin: false, canAccept: false },
};
