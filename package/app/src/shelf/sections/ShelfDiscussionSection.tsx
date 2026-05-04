import { postThreadQuery } from "@rezics/api/post/post";
import { EmptyState } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { PostTreeSection, ReplyComposer } from "@/post";
import { useAuthModal } from "@/user/components/useAuthModal";
import { useAuth } from "@/user/pages/useAuth";

interface ShelfDiscussionSectionProps {
  shelfUnitId: string;
  maxDepth?: number;
}

export const ShelfDiscussionSection: React.FC<ShelfDiscussionSectionProps> = ({
  shelfUnitId,
  maxDepth = 5,
}) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const auth = useAuthModal("login");

  const { data } = useQuery(
    postThreadQuery(shelfUnitId, { mode: "threaded", maxDepth }),
  );
  const posts = data?.posts ?? [];
  const isEmpty = posts.length === 0;

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
            backgroundColor: "var(--rezics-sys-color-surface-subtle, rgba(0,0,0,0.04))",
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

      {isEmpty ? (
        <EmptyState title={t("shelf.discussion.empty.title")} />
      ) : (
        <PostTreeSection rootPostUnitId={shelfUnitId} maxDepth={maxDepth} />
      )}
    </div>
  );
};
