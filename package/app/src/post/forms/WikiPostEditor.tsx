import { getLockedFieldError } from "@rezics/api";
import {
  useCreateWikiPostMutation,
  useSetPostPublicationMutation,
  useUpdateWikiPostContentMutation,
} from "@rezics/api/post/post";
import {
  mainMarkdownSource,
  markdownContentDoc,
  type PostDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Alert, AlertDescription, Button } from "@rezics/ui/shadcn";
import { useMemo, useState } from "react";
import { DraftPublishActions } from "@/draft";
import { policyDenialFromError } from "@/policy";
import { useAuthoringLanguageState } from "@/shared/hooks/useAuthoringLanguageDefault";
import { RootPostTranslationEditor } from "./RootPostTranslationEditor";

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
  const { defaultLanguage, language, setLanguage } = useAuthoringLanguageState({
    initialLanguage: post?.resolvedLanguage,
  });
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(mainMarkdownSource(post?.content) ?? "");
  const [lockedError, setLockedError] = useState<string | null>(null);
  const resize = useMemo(
    () => ({ height: 220, minHeight: 140, maxHeight: 520 }),
    [],
  );
  const createMutation = useCreateWikiPostMutation({ onSuccess: onSaved });
  const updateMutation = useUpdateWikiPostContentMutation({
    onSuccess: onSaved,
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
  const publicationMutation = useSetPostPublicationMutation({
    onSuccess: onSaved,
  });
  const activeMutation = post ? updateMutation : createMutation;

  // Create surfaces policy denials inline; edit keeps the locked-field alert.
  const createDenial = policyDenialFromError(createMutation.error);
  const isPublished = post?.status === "PUBLISHED";

  const handleCreate = (status: "DRAFT" | "PUBLISHED") => {
    const trimmed = body.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !trimmed) return;
    setLockedError(null);
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
    updateMutation.mutate({
      unitId: post.unitId,
      title: trimmedTitle === post.title ? undefined : trimmedTitle,
      content: markdownContentDoc(trimmed),
      language,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {lockedError ? (
        <Alert variant="destructive">
          <AlertDescription>{lockedError}</AlertDescription>
        </Alert>
      ) : null}
      <RootPostTranslationEditor
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
            disabled={updateMutation.isPending || !title.trim() || !body.trim()}
          >
            {updateMutation.isPending ? t("common:saving") : t("common:update")}
          </Button>
        </div>
      ) : (
        <DraftPublishActions
          className="items-end"
          onSaveDraft={() => handleCreate("DRAFT")}
          onPublish={() => handleCreate("PUBLISHED")}
          isPending={createMutation.isPending}
          saveDraftDisabled={!title.trim() || !body.trim()}
          publishDisabled={!title.trim() || !body.trim()}
          denial={createDenial}
        />
      )}
    </div>
  );
}
