import type { PostDTO } from "@rezics/contract";
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
  joining?: boolean;
  joinPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree?: () => void;
}

export const RealmRuleDialog: React.FC<RealmRuleDialogProps> = ({
  open,
  post,
  joining = false,
  joinPending = false,
  onOpenChange,
  onAgree,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Realm rules</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <PostBodyMarkdown body={post?.body ?? ""} clamp={false} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {joining ? "Cancel" : "Close"}
          </Button>
          {joining && (
            <Button onClick={onAgree} disabled={joinPending}>
              {joinPending ? "Joining..." : "Agree and Join"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
