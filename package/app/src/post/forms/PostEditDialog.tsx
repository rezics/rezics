import { getLockedFieldError } from "@rezics/api";
import { useUpdateCommentMutation } from "@rezics/api/comment/comment";
import {
  useUpdatePostMutation,
  useUpdateWikiPostContentMutation,
} from "@rezics/api/post/post";
import type { CommentDTO, PostDTO } from "@rezics/contract";
import {
  type ContentLanguage,
  CONTENT_LANGUAGE_SLUGS,
  languageLabel,
  mainMarkdownSource,
  markdownContentDoc,
  normalizeContentLanguage,
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { isPostEditorSurfaceSubmittable } from "../models/postEditorSurface";
import { PostEditorSurface } from "./PostEditorSurface";

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
  const isComment = "rootUnitId" in post;
  const [title, setTitle] = useState(!isComment ? (post.title ?? "") : "");
  const [text, setText] = useState(mainMarkdownSource(post.content) ?? "");
  const [language, setLanguage] = useState<ContentLanguage>(
    normalizeContentLanguage(
      isComment ? (post.language ?? locale) : (post.resolvedLanguage ?? locale),
    ) ?? locale,
  );
  const [lockedError, setLockedError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const originalTitle = isComment ? "" : (post.title ?? "");
  const isWikiPost = !isComment && post.kind === PostKind.WIKI;

  const handleSuccess = () => {
    toast.success(t("common:saved"));
    onClose();
  };

  const handlePostError = (error: Error) => {
    const locked = getLockedFieldError(error);
    if (locked) {
      setLockedError(
        locked.offendingLockPath && locked.offendingPatchPath
          ? t("community:post_edit_locked_path_detail", {
              lockPath: locked.offendingLockPath,
              patchPath: locked.offendingPatchPath,
            })
          : locked.blockedPaths.length
            ? t("community:post_edit_locked_paths", {
                paths: locked.blockedPaths.join(", "),
              })
            : locked.message,
      );
      return;
    }
    setSaveError(error.message);
    toast.error(error.message);
  };

  const updateMutation = useUpdatePostMutation({
    onSuccess: handleSuccess,
    onError: handlePostError,
  });
  const updateWikiMutation = useUpdateWikiPostContentMutation({
    onSuccess: handleSuccess,
    onError: handlePostError,
  });
  const updateCommentMutation = useUpdateCommentMutation({
    onSuccess: handleSuccess,
    onError: (error) => {
      setSaveError(error.message);
      toast.error(error.message);
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
    setSaveError(null);
    const trimmedTitle = isComment ? undefined : title.trim();
    if (!isComment && !trimmedTitle) return;
    const content = markdownContentDoc(text.trim());
    if (isWikiPost) {
      updateWikiMutation.mutate({
        unitId: post.unitId,
        title: trimmedTitle === originalTitle ? undefined : trimmedTitle,
        content,
        language,
      });
      return;
    }
    if (isComment) {
      updateCommentMutation.mutate({
        id: post.unitId,
        input: { content, language },
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
            language,
          },
        },
      },
    });
  };
  const validationMessage = (
    isComment
      ? !text.trim()
      : !isPostEditorSurfaceSubmittable({ title, body: text })
  )
    ? t("common:required")
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isWikiPost ? t("community:post_edit_wiki_post") : t("common:edit")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          {lockedError || saveError ? (
            <Alert variant="destructive">
              <AlertDescription>{lockedError ?? saveError}</AlertDescription>
            </Alert>
          ) : null}
          {isComment ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="min-h-[120px] max-h-[400px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <Select
                value={language}
                onValueChange={(nextLanguage) =>
                  setLanguage(normalizeContentLanguage(nextLanguage) ?? locale)
                }
              >
                <SelectTrigger
                  aria-label={t("common:language")}
                  className="h-9 w-[9.5rem] max-w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CONTENT_LANGUAGE_SLUGS.map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {languageLabel(lang)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <PostEditorSurface
              post={post}
              language={language}
              defaultLanguage={locale}
              title={title}
              body={text}
              onLanguageChange={(nextLanguage) =>
                setLanguage(normalizeContentLanguage(nextLanguage) ?? locale)
              }
              onTitleChange={setTitle}
              onBodyChange={setText}
              titlePlaceholder={t("community:post_title_placeholder")}
              disabled={activeMutation.isPending}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common:cancel")}
          </Button>
          <div className="flex flex-col items-end gap-1">
            <Button
              onClick={handleSubmit}
              disabled={activeMutation.isPending || Boolean(validationMessage)}
            >
              {activeMutation.isPending ? t("common:saving") : t("common:save")}
            </Button>
            {validationMessage ? (
              <p className="m-0 text-xs leading-dense text-error-text">
                {validationMessage}
              </p>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

