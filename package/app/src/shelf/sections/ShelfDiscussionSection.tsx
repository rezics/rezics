import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";
import { PostListSection, ReplyComposer } from "@/post";
import { useAuthModal } from "@/user/components/useAuthModal";
import { useAuth } from "@/user/pages/useAuth";

interface ShelfDiscussionSectionProps {
  shelfUnitId: string;
  maxDepth?: number;
}

export const ShelfDiscussionSection: React.FC<ShelfDiscussionSectionProps> = ({
  shelfUnitId,
}) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const auth = useAuthModal("login");

  return (
    <div className="flex flex-col gap-4">
      {isAuthenticated ? (
        <ReplyComposer
          mode="progressive"
          targetUnitId={shelfUnitId}
          placeholder={t("shelf.discussion.composer.placeholder")}
        />
      ) : (
        <div
          className="flex items-center justify-between gap-4 rounded-md p-4"
          style={{
            backgroundColor: "var(--colors-surface-subtle, rgba(0,0,0,0.04))",
          }}
        >
          <p className="text-sm text-text-secondary">
            {t("shelf.discussion.signInPrompt")}
          </p>
          <Button size="sm" onClick={auth.openLogin}>
            {t("auth.login")}
          </Button>
          {auth.AuthModal({})}
        </div>
      )}

      <PostListSection targetUnitId={shelfUnitId} />
    </div>
  );
};
