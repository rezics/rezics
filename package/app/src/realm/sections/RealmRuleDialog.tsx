import type { PostDTO, RealmRuleResolvedItemDTO } from "@rezics/contract";
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
  rules?: RealmRuleResolvedItemDTO[];
  joining?: boolean;
  joinPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree?: () => void;
}

export const RealmRuleDialog: React.FC<RealmRuleDialogProps> = ({
  open,
  post,
  content,
  rules,
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
          {rules?.length ? (
            <div className="divide-y divide-border-subtle">
              {rules.map((rule, index) => (
                <section key={rule.id} className="py-3 first:pt-0 last:pb-0">
                  <h3 className="mb-2 text-sm font-medium leading-ui text-text-primary">
                    {index + 1}
                  </h3>
                  <PostBodyMarkdown
                    content={rule.sourceRulePost?.content}
                    clamp={false}
                  />
                </section>
              ))}
            </div>
          ) : (
            <PostBodyMarkdown content={body} clamp={false} />
          )}
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
