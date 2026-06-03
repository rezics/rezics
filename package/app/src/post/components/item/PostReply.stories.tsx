import type { CommentDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { DropdownMenuItem } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pencil } from "lucide-react";
import { withRouter } from "@/stories/decorators/withRouter";
import { postFlat } from "@/stories/fixtures/post";
import { PostReply } from "./PostReply";

const redactedComment = (
  redactionKind: NonNullable<CommentDTO["redactionKind"]>,
): CommentDTO =>
  ({
    ...postFlat[0],
    id: `comment-redacted-${redactionKind}`,
    unitId: `comment-redacted-${redactionKind}`,
    rootUnitId: postFlat[0].unitId,
    parentCommentId: null,
    author: undefined,
    authorUserId: null,
    content: null,
    moderationStatus:
      redactionKind === "author_deleted" ? "approved" : "removed",
    isRedacted: true,
    redactionKind,
    depth: 1,
    directReplyCount: 2,
  }) as CommentDTO;

const Wrapper = (args: { showAvatar?: boolean }) => {
  const post = {
    ...postFlat[0],
    directReplyCount: 3,
  };
  return <PostReply post={post} showAvatar={args.showAvatar} />;
};

const meta = {
  title: "Domain/Post/PostReply",
  component: Wrapper,
  decorators: [withRouter],
  args: { showAvatar: true },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { showAvatar: false },
};

export const TitlelessComment: Story = {
  render: () => (
    <PostReply
      post={{
        ...postFlat[0],
        title: "Root-only title that replies do not render",
        directReplyCount: 3,
      }}
    />
  ),
};

export const OwnerVisibleEditOverflow: Story = {
  render: () => {
    const { t } = useTranslation(["common"]);
    return (
      <PostReply
        post={{ ...postFlat[0], directReplyCount: 3 }}
        overflowContent={
          <DropdownMenuItem className="gap-2">
            <Pencil size={16} strokeWidth={2} />
            <span>{t("common:edit")}</span>
          </DropdownMenuItem>
        }
      />
    );
  },
};

export const UnauthorizedHiddenEditOverflow: Story = {
  render: () => <PostReply post={{ ...postFlat[0], directReplyCount: 3 }} />,
};

export const ModeratorRemoved: Story = {
  render: () => <PostReply post={redactedComment("moderator_removed")} />,
};

export const AuthorDeleted: Story = {
  render: () => <PostReply post={redactedComment("author_deleted")} />,
};
