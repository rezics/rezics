import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { ReplyComposer } from "@/comment";
import { PostListSection } from "@/post";
import { useAuth, useAuthModal } from "@/user";

interface ShelfDiscussionSectionProps {
  shelfItemId: string;
  maxDepth?: number;
}

/**
 * Shelf discussion section.
 *
 * Shows discussion/comments on a shelf item. Authenticated users can compose
 * replies. Unauthenticated users see a sign-in prompt to participate.
 *
 * 书架项目讨论区域。显示对书架项目的讨论和评论。
 * 已登录用户可以撰写回复。未登录用户看到登录提示。
 *
 * Desktop (1200px):
 * +---------------------------------------------+
 * | [Reply Composer]                            |
 * | [_________________________________]         |
 * | [Preview] [Cancel]      [Post Comment]      |
 * +---------------------------------------------+
 * | Discussion                                  |
 * | Comment 1 - Author | 2 days ago             |
 * | Comment text here...                        |
 * | [Like] [Reply] [More]                       |
 * |   - Reply 1 - Author 2 | 1 day ago          |
 * |     Reply text here...                      |
 * +---------------------------------------------+
 *
 * Tablet (768px):
 * +---------------------------------+
 * | [Composer]                      |
 * | [___________________]           |
 * | [Cancel]     [Post]             |
 * +---------------------------------+
 * | Discussion                      |
 * | Comment 1 | Author | 2 days ago |
 * | Text...                         |
 * | [Like] [Reply] [More]           |
 * |   - Reply 1 | Author 2          |
 * +---------------------------------+
 *
 * Mobile (360px):
 * +----------+
 * | [Compose]|
 * | [____]   |
 * | [Post]   |
 * +----------+
 * | Discussion
 * | Author 1 |
 * | 2 days   |
 * | Text...  |
 * |          |
 * | Author 2 |
 * | 1 day    |
 * +----------+
 *
 * Unauthenticated (360px):
 * +----------+
 * | Sign in  |
 * | to reply |
 * |          |
 * | [Login]  |
 * +----------+
 * | Discussion
 * | Author 1 |
 * | Text...  |
 * +----------+
 */
export const ShelfDiscussionSection: React.FC<ShelfDiscussionSectionProps> = ({
  shelfItemId,
}) => {
  const { t } = useTranslation(["auth", "entity"]);
  const { isAuthenticated } = useAuth();
  const auth = useAuthModal("login");

  return (
    <div className="flex flex-col gap-4">
      {isAuthenticated ? (
        <ReplyComposer
          mode="progressive"
          targetUnitId={shelfItemId}
          placeholder={t("entity:shelf_discussion_composer_placeholder")}
        />
      ) : (
        <div
          className="flex items-center justify-between gap-4 rounded-md p-4"
          style={{
            backgroundColor: "var(--colors-surface-subtle, rgba(0,0,0,0.04))",
          }}
        >
          <p className="text-sm text-text-secondary">
            {t("entity:shelf_discussion_signInPrompt")}
          </p>
          <Button size="sm" onClick={auth.openLogin}>
            {t("auth:login")}
          </Button>
          {auth.AuthModal({})}
        </div>
      )}

      <PostListSection targetUnitId={shelfItemId} />
    </div>
  );
};
