import { getLockedFieldError } from "@rezics/api";
import {
  useUpdatePostMutation,
  useUpdateWikiPostContentMutation,
} from "@rezics/api/post/post";
import type { PostDTO } from "@rezics/contract";
import {
  mainMarkdownSource,
  markdownContentDoc,
  PostKind,
} from "@rezics/contract";
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
import { useMessage } from "@rezics/i18n/react";
import {
  common_cancel,
  common_edit,
  common_save,
  common_saving,
  post_edit_wiki_post,
} from "@rezics/i18n/messages";
const m = {
  common_cancel,
  common_edit,
  common_save,
  common_saving,
  post_edit_wiki_post,
};

const i18nMessages = {
  common_cancel,
  common_edit,
  common_save,
  common_saving,
  post_edit_wiki_post,
};

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
  const m = useMessage(i18nMessages);
  const [text, setText] = useState(mainMarkdownSource(post.content) ?? "");
  const [lockedError, setLockedError] = useState<string | null>(null);
  const isWikiPost = post.kind === PostKind.WIKI;

  const updateMutation = useUpdatePostMutation({
    onSuccess: () => {
      onClose();
    },
  });
  const updateWikiMutation = useUpdateWikiPostContentMutation({
    onSuccess: () => {
      onClose();
    },
    onError: (error) => {
      const locked = getLockedFieldError(error);
      if (!locked) return;
      setLockedError(
        locked.offendingLockPath && locked.offendingPatchPath
          ? `Locked path: ${locked.offendingLockPath}; patch path: ${locked.offendingPatchPath}`
          : locked.blockedPaths.length
            ? `Locked paths: ${locked.blockedPaths.join(", ")}`
            : locked.message,
      );
    },
  });
  const activeMutation = isWikiPost ? updateWikiMutation : updateMutation;

  const handleSubmit = () => {
    if (!text.trim()) return;
    setLockedError(null);
    const content = markdownContentDoc(text.trim());
    if (isWikiPost) {
      updateWikiMutation.mutate({ unitId: post.unitId, content });
      return;
    }
    updateMutation.mutate({
      unitId: post.unitId,
      input: { patch: { post: { content } } },
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
