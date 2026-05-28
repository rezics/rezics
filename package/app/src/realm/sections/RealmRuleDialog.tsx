import type { PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import type React from "react";
import { PostBodyMarkdown } from "@/post";

export interface RealmRuleDialogProps {
  open: boolean;
  post?: PostDTO | null;
  content?: unknown;
  joining?: boolean;
  joinPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree?: () => void;
}

export const RealmRuleDialog: React.FC<RealmRuleDialogProps> = ({
  open,
  post,
  content,
  joining = false,
  joinPending = false,
  onOpenChange,
  onAgree,
}) => {
  const { t } = useTranslation(["common", "entity"]);
  const body = content ?? post?.content;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("entity:realm_rules_title")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <PostBodyMarkdown content={body} clamp={false} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {joining ? t("common:cancel") : t("common:close")}
          </Button>
          {joining && (
            <Button onClick={onAgree} disabled={joinPending}>
              {joinPending
                ? t("entity:realm_joining")
                : t("entity:realm_agree_and_join")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
