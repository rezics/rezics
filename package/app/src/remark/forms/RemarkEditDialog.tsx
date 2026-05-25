import { useUpdatePostMutation } from "@rezics/api/post/post";
import {
  mainMarkdownSource,
  markdownContentDoc,
  type PostDTO,
  SCORE_MAX,
} from "@rezics/contract";
import { RatingInput } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  common_cancel,
  common_edit,
  common_save,
  common_saving,
  remark_form_rating,
} from "@rezics/i18n/messages";
const m = {
  common_cancel,
  common_edit,
  common_save,
  common_saving,
  remark_form_rating,
};

const i18nMessages = {
  common_cancel,
  common_edit,
  common_save,
  common_saving,
  remark_form_rating,
};

interface RemarkEditDialogProps {
  remark: PostDTO;
  open: boolean;
  onClose: () => void;
}

export const RemarkEditDialog: React.FC<RemarkEditDialogProps> = ({
  remark,
  open,
  onClose,
}) => {
  const m = useMessage(i18nMessages);
  const initialRating = (remark.extra as { rating?: number } | null)?.rating;
  const [score, setScore] = useState<number | null>(
    typeof initialRating === "number" ? initialRating : null,
  );
  const [text, setText] = useState(mainMarkdownSource(remark.content) ?? "");

  const updateMutation = useUpdatePostMutation({
    onSuccess: () => {
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!text.trim()) return;
    const nextExtra = {
      ...(remark.extra ?? {}),
      ...(score !== null ? { rating: score } : {}),
    };
    updateMutation.mutate({
      unitId: remark.unitId,
      input: {
        patch: {
          post: {
            content: markdownContentDoc(text.trim()),
            extra: nextExtra,
          },
        },
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{m.common_edit()}</DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          <div className="flex flex-col gap-4">
            <RatingInput
              value={score}
              onChange={setScore}
              max={SCORE_MAX}
              aria-label={m.remark_form_rating()}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending || !text.trim()}
          >
            {updateMutation.isPending ? m.common_saving() : m.common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
