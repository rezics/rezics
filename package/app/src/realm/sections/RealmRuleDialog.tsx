import type { PostDTO } from "@rezics/contract";
import {
  common_cancel,
  common_close,
  realm_agree_and_join,
  realm_joining,
  realm_rules_title,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
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

const i18nMessages = {
  common_cancel,
  common_close,
  realm_agree_and_join,
  realm_joining,
  realm_rules_title,
};

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
  const m = useMessage(i18nMessages);
  const body = content ?? post?.content;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{m.realm_rules_title()}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <PostBodyMarkdown content={body} clamp={false} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {joining ? m.common_cancel() : m.common_close()}
          </Button>
          {joining && (
            <Button onClick={onAgree} disabled={joinPending}>
              {joinPending ? m.realm_joining() : m.realm_agree_and_join()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
