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
import { useTranslation } from "@rezics/i18n/react";
import type { ReasonStatus } from "../models/extra";
import {
  type ReasonPost,
  useReasonPostHistory,
} from "../hooks/useReasonPostHistory";
import type { ReasonPostVisibility } from "../hooks/useReasonPostMutations";

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

const TITLE_KEY: Record<ReasonStatus, { key: string; fallback: string }> = {
  PAUSED: {
    key: "progress_status.reason_modal.title_paused",
    fallback: "擱置原因",
  },
  DROPPED: {
    key: "progress_status.reason_modal.title_dropped",
    fallback: "棄讀原因",
  },
};

const DESC_KEY: Record<ReasonStatus, { key: string; fallback: string }> = {
  PAUSED: {
    key: "progress_status.reason_modal.desc_paused",
    fallback: "說說你為什麼擱置這本書？",
  },
  DROPPED: {
    key: "progress_status.reason_modal.desc_dropped",
    fallback: "說說你為什麼棄讀這本書？",
  },
};

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
  const { t } = useTranslation();
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
          <DialogTitle>
            {t(TITLE_KEY[status].key, TITLE_KEY[status].fallback)}
          </DialogTitle>
          <DialogDescription>
            {t(DESC_KEY[status].key, DESC_KEY[status].fallback)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t(
              "progress_status.reason_modal.placeholder",
              "輸入你的想法…",
            )}
            rows={6}
          />

          <Label className="flex items-center gap-2 text-sm text-text-muted">
            <Checkbox
              checked={isPrivate}
              onCheckedChange={(c) => setIsPrivate(c === true)}
            />
            {t("progress_status.reason_modal.private", "僅自己可見")}
          </Label>

          {hasHistory && olderPosts.length > 0 && (
            <Collapsible open={showHistory} onOpenChange={setShowHistory}>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-text-muted">
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showHistory ? "rotate-180" : ""
                  }`}
                />
                {t("progress_status.reason_modal.history", "查看過去紀錄")}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 grid gap-2">
                {postsLoading
                  ? t("common.loading", "載入中…")
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
            {t("progress_status.reason_modal.skip", "跳過")}
          </Button>
          {hasHistory && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onAppend({ body, visibility })}
              disabled={isPending || body.trim().length === 0}
            >
              {t("progress_status.reason_modal.append", "新增")}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => onSave({ body, visibility, mode: "create-or-edit" })}
            disabled={isPending || body.trim().length === 0}
          >
            {t("common.save", "儲存")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
