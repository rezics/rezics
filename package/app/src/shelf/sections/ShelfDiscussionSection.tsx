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
