import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CommentPromotionControls } from "./CommentPromotionControls";

/**
 * The controls render as overflow-menu entries; the stories show them inside an
 * always-open dropdown so the entries are visible for review. In the app they
 * are injected through `renderOverflowContent` into the reply `ReactionBar`.
 * 这些控件渲染为溢出菜单项；故事将它们放在一个始终打开的下拉菜单中，
 * 以便审阅时可见。在应用中，它们通过 `renderOverflowContent` 注入到回复的
 * `ReactionBar` 内。
 */
const noop = () => undefined;

const Frame = (
  props: React.ComponentProps<typeof CommentPromotionControls>,
) => (
  <DropdownMenu open>
    <DropdownMenuTrigger>Overflow</DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <CommentPromotionControls {...props} />
    </DropdownMenuContent>
  </DropdownMenu>
);

const meta = {
  title: "Domain/Comment/CommentPromotionControls",
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

/** Unpromoted, direct reply of a question thread: Pin and Accept offered. 问题主题下未提升的直接回复：提供 Pin 和 Accept。 */
export const PinAndAccept: Story = {};

/** Non-question thread: only Pin is offered. 非问题主题：仅提供 Pin。 */
export const PinOnly: Story = {
  args: { canAccept: false },
};

/** Pinned reply: only Unpin is offered. 已置顶的回复：仅提供 Unpin。 */
export const Pinned: Story = {
  args: { pinKind: "PINNED" },
};

/** Accepted answer: only Unaccept is offered. 已采纳的答案：仅提供 Unaccept。 */
export const Accepted: Story = {
  args: { pinKind: "ACCEPTED_ANSWER" },
};

/** Viewer without authority: no entries render. 无权限的查看者：不渲染任何菜单项。 */
export const NoControls: Story = {
  args: { canPin: false, canAccept: false },
};
