import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { withRouter } from "@/stories/decorators/withRouter";
import { postFlat } from "@/stories/fixtures/post";
import { PostReply } from "./PostReply";

const Wrapper = (args: {
  indentLevel: number;
  initialCollapsed?: boolean;
  hasChildren?: boolean;
}) => {
  const [collapsed, setCollapsed] = useState(args.initialCollapsed ?? false);
  const post = {
    ...postFlat[0],
    directReplyCount: args.hasChildren ? 3 : 0,
  };
  return (
    <PostReply
      post={post}
      indentLevel={args.indentLevel}
      isCollapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
    />
  );
};

const meta = {
  title: "Domain/Post/PostReply",
  component: Wrapper,
  decorators: [withRouter],
  args: { indentLevel: 0, hasChildren: true },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { indentLevel: 2, hasChildren: false },
};

export const Empty: Story = {
  args: { indentLevel: 0, initialCollapsed: true, hasChildren: true },
};
