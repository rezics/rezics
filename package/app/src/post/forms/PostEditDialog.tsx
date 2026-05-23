import { getLockedFieldError } from "@rezics/api";
import {
  useUpdatePostMutation,
  useUpdateWikiPostBodyMutation,
} from "@rezics/api/post/post";
import type { PostDTO } from "@rezics/contract";
import { PostKind } from "@rezics/contract";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";
import * as m from "@rezics/i18n/messages";

interface PostEditDialogProps {
  post: PostDTO;
  open: boolean;
  onClose: () => void;
}

export const PostEditDialog: React.FC<PostEditDialogProps> = ({
  post,
  open,
  onClose,
}) => {
  const [text, setText] = useState(post.body ?? "");
  const [lockedError, setLockedError] = useState<string | null>(null);
  const isWikiPost = post.kind === PostKind.WIKI;

  const updateMutation = useUpdatePostMutation({
    onSuccess: () => {
      onClose();
    },
  });
  const updateWikiMutation = useUpdateWikiPostBodyMutation({
    onSuccess: () => {
      onClose();
    },
    onError: (error) => {
      const locked = getLockedFieldError(error);
      if (!locked) return;
      setLockedError(
        locked.blockedFieldKeys.length
          ? `Locked fields: ${locked.blockedFieldKeys.join(", ")}`
          : locked.message,
      );
    },
  });
  const activeMutation = isWikiPost ? updateWikiMutation : updateMutation;

  const handleSubmit = () => {
    if (!text.trim()) return;
    setLockedError(null);
    if (isWikiPost) {
      updateWikiMutation.mutate({ unitId: post.unitId, body: text.trim() });
      return;
    }
    updateMutation.mutate({
      unitId: post.unitId,
      input: { body: text.trim() },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isWikiPost ? m.post_edit_wiki_post() : m.common_edit()}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          {lockedError ? (
            <Alert variant="destructive">
              <AlertDescription>{lockedError}</AlertDescription>
            </Alert>
          ) : null}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full min-h-[120px] max-h-[400px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {m.common_cancel()}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={activeMutation.isPending || !text.trim()}
          >
            {activeMutation.isPending ? m.common_saving() : m.common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
