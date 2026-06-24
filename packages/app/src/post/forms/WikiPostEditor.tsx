import { getLockedFieldError } from "@rezics/contract/api";
import {
  useCreateWikiPostMutation,
  useSetPostPublicationMutation,
  useUpdateWikiPostContentMutation,
} from "@rezics/contract/api/post/post";
import {
  mainMarkdownSource,
  markdownContentDoc,
  type PostDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Alert, AlertDescription, Button } from "@rezics/ui/shadcn";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DraftPublishActions } from "@/draft";
import { policyDenialFromError } from "@/policy";
import { useAutoDetectedAuthoringLanguageState } from "@/shared/hooks/useAuthoringLanguageDefault";
import { isPostEditorSurfaceSubmittable } from "../models/postEditorSurface";
import { PostEditorSurface } from "./PostEditorSurface";

export interface WikiPostEditorProps {
  targetUnitId?: string;
  realmUnitIds?: string[];
  post?: PostDTO;
  onSaved?: (post: PostDTO) => void;
  onCancel?: () => void;
}

export function WikiPostEditor({
  targetUnitId,
  realmUnitIds,
  post,
  onSaved,
  onCancel,
}: WikiPostEditorProps) {
  const { t } = useTranslation(["common"]);
  const { t: tc } = useTranslation(["community"]);
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(mainMarkdownSource(post?.content) ?? "");
  const { defaultLanguage, language, setLanguage } =
    useAutoDetectedAuthoringLanguageState({
      text: `${title}\n${body}`,
      initialLanguage: post?.resolvedLanguage,
      enabled: !post,
    });
  const [lockedError, setLockedError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const resize = useMemo(
    () => ({ height: 220, minHeight: 140, maxHeight: 520 }),
    [],
  );
  const handleSaved = (savedPost: PostDTO) => {
    toast.success(t("common:saved"));
    onSaved?.(savedPost);
  };
  const handleError = (error: Error) => {
    setSaveError(error.message);
    toast.error(error.message);
  };
  const createMutation = useCreateWikiPostMutation({
    onSuccess: handleSaved,
    onError: handleError,
  });
  const updateMutation = useUpdateWikiPostContentMutation({
    onSuccess: handleSaved,
    onError: (error) => {
      const locked = getLockedFieldError(error);
      if (!locked) {
        handleError(error);
        return;
      }
      setLockedError(
        locked.offendingLockPath && locked.offendingPatchPath
          ? tc("community:post_edit_locked_path_detail", {
              lockPath: locked.offendingLockPath,
              patchPath: locked.offendingPatchPath,
            })
          : locked.blockedPaths.length
            ? tc("community:post_edit_locked_paths", {
                paths: locked.blockedPaths.join(", "),
              })
            : locked.message,
      );
    },
  });
  const publicationMutation = useSetPostPublicationMutation({
    onSuccess: handleSaved,
    onError: handleError,
  });
  const activeMutation = post ? updateMutation : createMutation;

  // Create surfaces policy denials inline; edit keeps the locked-field alert.
  // 创建时内联展示策略拒绝；编辑时保留锁定字段提示。
  const createDenial = policyDenialFromError(createMutation.error);
  const isPublished = post?.status === "PUBLISHED";

  const handleCreate = (status: "DRAFT" | "PUBLISHED") => {
    const trimmed = body.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !trimmed) return;
    setLockedError(null);
    setSaveError(null);
    const normalizedTargetUnitId = targetUnitId?.trim();
    createMutation.mutate({
      title: trimmedTitle,
      content: markdownContentDoc(trimmed),
      language,
      realmUnitIds,
      ...(normalizedTargetUnitId
        ? { targetUnitId: normalizedTargetUnitId }
        : {}),
      status,
    } as never);
  };

  const handleUpdate = () => {
    const trimmed = body.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !trimmed || !post) return;
    setLockedError(null);
    setSaveError(null);
    updateMutation.mutate({
      unitId: post.unitId,
      title: trimmedTitle === post.title ? undefined : trimmedTitle,
      content: markdownContentDoc(trimmed),
      language,
    });
  };
  const validationMessage = !isPostEditorSurfaceSubmittable({ title, body })
    ? t("common:required")
    : null;

  return (
    <div className="flex flex-col gap-3">
      {lockedError || saveError ? (
        <Alert variant="destructive">
          <AlertDescription>{lockedError ?? saveError}</AlertDescription>
        </Alert>
      ) : null}
      <PostEditorSurface
        post={post}
        language={language}
        defaultLanguage={defaultLanguage}
        title={title}
        body={body}
        onLanguageChange={setLanguage}
        onTitleChange={setTitle}
        onBodyChange={setBody}
        titlePlaceholder={tc("community:post_title_placeholder")}
        disabled={activeMutation.isPending}
        resize={resize}
      />

      {post ? (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center justify-end gap-2">
            {onCancel ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={activeMutation.isPending}
              >
                {t("common:cancel")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                publicationMutation.mutate({
                  unitId: post.unitId,
                  publish: !isPublished,
                })
              }
              disabled={publicationMutation.isPending}
            >
              {isPublished ? t("common:revert_to_draft") : t("common:publish")}
            </Button>
            <Button
              type="button"
              onClick={handleUpdate}
              disabled={updateMutation.isPending || Boolean(validationMessage)}
            >
              {updateMutation.isPending
                ? t("common:saving")
                : t("common:update")}
            </Button>
          </div>
          {validationMessage ? (
            <p className="m-0 text-xs leading-dense text-error-text">
              {validationMessage}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col items-end gap-1">
          <DraftPublishActions
            className="items-end"
            onSaveDraft={() => handleCreate("DRAFT")}
            onPublish={() => handleCreate("PUBLISHED")}
            isPending={createMutation.isPending}
            saveDraftDisabled={Boolean(validationMessage)}
            publishDisabled={Boolean(validationMessage)}
            denial={createDenial}
          />
          {validationMessage ? (
            <p className="m-0 text-xs leading-dense text-error-text">
              {validationMessage}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
