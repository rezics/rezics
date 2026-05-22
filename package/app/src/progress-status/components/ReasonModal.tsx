import {
  Button,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@rezics/ui/shadcn";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReasonStatus } from "../models/extra";
import {
  type ReasonPost,
  useReasonPostHistory,
} from "../hooks/useReasonPostHistory";
import type { ReasonPostVisibility } from "../hooks/useReasonPostMutations";
import * as m from "@rezics/i18n/messages";

type ReasonModalProps = {
  open: boolean;
  status: ReasonStatus;
  reasonPostUnitIds: string[];
  onCancel: () => void;
  onSkip: () => void;
  onSave: (payload: {
    body: string;
    visibility: ReasonPostVisibility;
    mode: "create-or-edit";
  }) => void;
  onAppend: (payload: {
    body: string;
    visibility: ReasonPostVisibility;
  }) => void;
  isPending?: boolean;
};

const TITLE_MESSAGE = {
  PAUSED: m.progress_status_reason_modal_title_paused,
  DROPPED: m.progress_status_reason_modal_title_dropped,
} as const satisfies Record<ReasonStatus, () => string>;

const DESC_MESSAGE = {
  PAUSED: m.progress_status_reason_modal_desc_paused,
  DROPPED: m.progress_status_reason_modal_desc_dropped,
} as const satisfies Record<ReasonStatus, () => string>;

export function ReasonModal({
  open,
  status,
  reasonPostUnitIds,
  onCancel,
  onSkip,
  onSave,
  onAppend,
  isPending,
}: ReasonModalProps) {
  const { posts, isLoading: postsLoading } =
    useReasonPostHistory(reasonPostUnitIds);

  const latestPost: ReasonPost | undefined = posts[posts.length - 1];
  const olderPosts = posts.slice(0, -1).reverse();
  const hasHistory = posts.length > 0;

  const [body, setBody] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setBody(latestPost?.body ?? "");
      setIsPrivate(false);
      setShowHistory(false);
    }
  }, [open, latestPost?.body]);

  const visibility: ReasonPostVisibility = isPrivate ? "UNLISTED" : "PUBLIC";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLE_MESSAGE[status]()}</DialogTitle>
          <DialogDescription>{DESC_MESSAGE[status]()}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={m.progress_status_reason_modal_placeholder()}
            rows={6}
          />

          <Label className="flex items-center gap-2 text-sm text-text-muted">
            <Checkbox
              checked={isPrivate}
              onCheckedChange={(c) => setIsPrivate(c === true)}
            />
            {m.progress_status_reason_modal_private()}
          </Label>

          {hasHistory && olderPosts.length > 0 && (
            <Collapsible open={showHistory} onOpenChange={setShowHistory}>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-text-muted">
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showHistory ? "rotate-180" : ""
                  }`}
                />
                {m.progress_status_reason_modal_history()}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 grid gap-2">
                {postsLoading
                  ? m.common_loading()
                  : olderPosts.map((p) => (
                      <article
                        key={p.unitId}
                        className="rounded-md bg-surface-elevated p-2 text-sm text-text-secondary"
                      >
                        {p.body}
                      </article>
                    ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onSkip}>
            {m.progress_status_reason_modal_skip()}
          </Button>
          {hasHistory && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onAppend({ body, visibility })}
              disabled={isPending || body.trim().length === 0}
            >
              {m.progress_status_reason_modal_append()}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => onSave({ body, visibility, mode: "create-or-edit" })}
            disabled={isPending || body.trim().length === 0}
          >
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
