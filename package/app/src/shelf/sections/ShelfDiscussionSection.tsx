import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { PostListSection, ReplyComposer } from "@/post";
import { useAuthModal } from "@/user/components/useAuthModal";
import { useAuth } from "@/user/pages/useAuth";
import { useMessage } from "@rezics/i18n/react";
import {
  auth_login,
  shelf_discussion_composer_placeholder,
  shelf_discussion_signInPrompt,
} from "@rezics/i18n/messages";
const m = {
  auth_login,
  shelf_discussion_composer_placeholder,
  shelf_discussion_signInPrompt,
};

const i18nMessages = {
  auth_login,
  shelf_discussion_composer_placeholder,
  shelf_discussion_signInPrompt,
};

interface ShelfDiscussionSectionProps {
  shelfUnitId: string;
  maxDepth?: number;
}

export const ShelfDiscussionSection: React.FC<ShelfDiscussionSectionProps> = ({
  shelfUnitId,
}) => {
  const m = useMessage(i18nMessages);
  const { isAuthenticated } = useAuth();
  const auth = useAuthModal("login");

  return (
    <div className="flex flex-col gap-4">
      {isAuthenticated ? (
        <ReplyComposer
          mode="progressive"
          targetUnitId={shelfUnitId}
          placeholder={m.shelf_discussion_composer_placeholder()}
        />
      ) : (
        <div
          className="flex items-center justify-between gap-4 rounded-md p-4"
          style={{
            backgroundColor: "var(--colors-surface-subtle, rgba(0,0,0,0.04))",
          }}
        >
          <p className="text-sm text-text-secondary">
            {m.shelf_discussion_signInPrompt()}
          </p>
          <Button size="sm" onClick={auth.openLogin}>
            {m.auth_login()}
          </Button>
          {auth.AuthModal({})}
        </div>
      )}

      <PostListSection targetUnitId={shelfUnitId} />
    </div>
  );
};
