import { getLockedFieldError } from "@rezics/api";
import { useUpdateCommentMutation } from "@rezics/api/comment/comment";
import {
  useUpdatePostMutation,
  useUpdateWikiPostContentMutation,
} from "@rezics/api/post/post";
import type { CommentDTO, PostDTO } from "@rezics/contract";
import {
  mainMarkdownSource,
  markdownContentDoc,
  PostKind,
} from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";

interface PostEditDialogProps {
  post: PostDTO | CommentDTO;
  open: boolean;
  onClose: () => void;
}

export const PostEditDialog: React.FC<PostEditDialogProps> = ({
  post,
  open,
  onClose,
}) => {
  const { t } = useTranslation(["common", "community"]);
  const locale = useLocale();
  const [title, setTitle] = useState(
    !("rootUnitId" in post) ? (post.title ?? "") : "",
  );
  const [text, setText] = useState(mainMarkdownSource(post.content) ?? "");
  const [lockedError, setLockedError] = useState<string | null>(null);
  const isComment = "rootUnitId" in post;
  const originalTitle = isComment ? "" : (post.title ?? "");
  const isWikiPost = !isComment && post.kind === PostKind.WIKI;

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
  const updateCommentMutation = useUpdateCommentMutation({
    onSuccess: () => {
      onClose();
    },
  });
  const activeMutation = isComment
    ? updateCommentMutation
    : isWikiPost
      ? updateWikiMutation
      : updateMutation;

  const handleSubmit = () => {
    if (!text.trim()) return;
    setLockedError(null);
    const trimmedTitle = isComment ? undefined : title.trim();
    if (!isComment && !trimmedTitle) return;
    const content = markdownContentDoc(text.trim());
    if (isWikiPost) {
      updateWikiMutation.mutate({
        unitId: post.unitId,
        title: trimmedTitle === originalTitle ? undefined : trimmedTitle,
        content,
        language: locale,
      });
      return;
    }
    if (isComment) {
      updateCommentMutation.mutate({
        unitId: post.unitId,
        input: { content },
      });
      return;
    }
    updateMutation.mutate({
      unitId: post.unitId,
      input: {
        patch: {
          post: {
            title: trimmedTitle === originalTitle ? undefined : trimmedTitle,
            content,
          },
        },
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isWikiPost ? t("community:post_edit_wiki_post") : t("common:edit")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          {lockedError ? (
            <Alert variant="destructive">
              <AlertDescription>{lockedError}</AlertDescription>
            </Alert>
          ) : null}
          {!isComment ? (
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("community:post_title_placeholder")}
              disabled={activeMutation.isPending}
            />
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
            {t("common:cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              activeMutation.isPending ||
              !text.trim() ||
              (!isComment && !title.trim())
            }
          >
            {activeMutation.isPending ? t("common:saving") : t("common:save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
