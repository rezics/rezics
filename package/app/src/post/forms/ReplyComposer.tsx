import { useCreateCommentMutation } from "@rezics/api/comment/comment";
import { useCreatePostMutation } from "@rezics/api/post/post";
import {
  markdownContentDoc,
  type CommentDTO,
  type PollDTO,
  type PostDTO,
  PostKind,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Input } from "@rezics/ui/shadcn";
import { BarChart3 } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { PollComposer } from "@/poll";
import { RealmPostTagPicker } from "@/realm/components/RealmPostTagPicker";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { useAuthGuard } from "@/user/hooks/useAuthGuard";

export type ReplyComposerMode = "progressive" | "expanded";

export type ReplyComposerHandle = {
  focus: () => void;
};

type ReplyComposerBaseProps = {
  mode: ReplyComposerMode;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitted?: (post: PostDTO | CommentDTO) => void;
  onCancelled?: () => void;
};

export type ReplyComposerReplyModeProps = ReplyComposerBaseProps & {
  targetUnitId: string;
  variantUnitId?: string;
  rootUnitId?: string;
  realmUnitId?: string | null;
  parentCommentUnitId?: string;
  realmUnitIds?: never;
  tagIds?: string[];
};

export type ReplyComposerRealmPostModeProps = ReplyComposerBaseProps & {
  realmUnitIds: string[];
  tagIds?: string[];
  targetUnitId?: never;
  parentCommentUnitId?: never;
};

export type ReplyComposerProps =
  | ReplyComposerReplyModeProps
  | ReplyComposerRealmPostModeProps;

/**
 * Blur-retain rule: if the body is empty, the composer should collapse on
 * blur; otherwise it retains the draft and stays expanded. Returning a
 * boolean here keeps the caller in charge of the actual open/closed state.
 */
export function useBlurRetain(body: string) {
  return useCallback(() => body.trim().length > 0, [body]);
}

/**
 * Lightweight inline composer for replies and simple contextual posts. Realm
 * page-level authoring owns wiki creation, draft publishing, and existing
 * content submission outside this component.
 */
export const ReplyComposer = forwardRef<
  ReplyComposerHandle,
  ReplyComposerProps
>(function ReplyComposer(props, ref) {
  const { t } = useTranslation([
    "auth",
    "common",
    "community",
    "entity",
    "page",
  ]);
  const authGuard = useAuthGuard();
  const {
    mode,
    placeholder = t("community:post_reply_placeholder"),
    autoFocus = false,
    onSubmitted,
    onCancelled,
  } = props;
  const isRealmPostMode = "realmUnitIds" in props;
  const realmUnitIds = isRealmPostMode ? props.realmUnitIds : undefined;
  const targetUnitId = isRealmPostMode ? undefined : props.targetUnitId;
  const variantUnitId = isRealmPostMode ? undefined : props.variantUnitId;
  const rootUnitId = isRealmPostMode ? undefined : props.rootUnitId;
  const realmUnitId = isRealmPostMode ? undefined : props.realmUnitId;
  const parentCommentUnitId = isRealmPostMode
    ? undefined
    : props.parentCommentUnitId;
  const isCommentReplyMode = !isRealmPostMode && Boolean(parentCommentUnitId);
  const canAttachPoll = !isCommentReplyMode;
  const initialTagIds = props.tagIds;
  const invalidMode =
    Boolean(realmUnitIds?.length) &&
    Boolean(
      (props as Partial<ReplyComposerReplyModeProps>).targetUnitId ||
        (props as Partial<ReplyComposerReplyModeProps>).parentCommentUnitId,
    );
  const invalidCommentReplyMode =
    isCommentReplyMode && (!rootUnitId || !realmUnitId);
  const startsExpanded = mode === "expanded" || autoFocus;
  const [expanded, setExpanded] = useState<boolean>(startsExpanded);
  const [body, setBody] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initialTagIds ?? [],
  );
  const [attachingPoll, setAttachingPoll] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const shouldRetainOnBlur = useBlurRetain(body);
  const postMutation = useCreatePostMutation();
  const commentMutation = useCreateCommentMutation();
  const submitting = postMutation.isPending || commentMutation.isPending;

  const submitReply = useCallback(
    (
      content: ReturnType<typeof markdownContentDoc>,
      options?: { pollUnitId?: string },
    ) => {
      if (parentCommentUnitId) {
        if (!rootUnitId || !realmUnitId || options?.pollUnitId) return;
        commentMutation.mutate(
          {
            rootUnitId,
            realmUnitId,
            parentCommentUnitId:
              parentCommentUnitId === rootUnitId
                ? undefined
                : parentCommentUnitId,
            content,
          },
          {
            onSuccess: (comment) => {
              reset();
              onSubmitted?.(comment);
            },
          },
        );
        return;
      }

      postMutation.mutate(
        {
          targetUnitId,
          variantUnitId,
          kind: PostKind.POST,
          content,
          ...(options?.pollUnitId
            ? { extra: { poll: { unitId: options.pollUnitId } } }
            : {}),
        },
        {
          onSuccess: (post) => {
            reset();
            onSubmitted?.(post);
          },
        },
      );
    },
    [
      commentMutation.mutate,
      onSubmitted,
      parentCommentUnitId,
      postMutation.mutate,
      realmUnitId,
      rootUnitId,
      targetUnitId,
      variantUnitId,
    ],
  );

  const resize = useMemo(
    () => ({ height: 150, minHeight: 100, maxHeight: 400 }),
    [],
  );

  const focusEditor = useCallback(() => {
    queueMicrotask(() => {
      const el = triggerRef.current?.querySelector<HTMLElement>(
        "textarea, [contenteditable='true']",
      );
      el?.focus();
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (!authGuard.requireAuth()) return;
        setExpanded(true);
        focusEditor();
      },
    }),
    [authGuard.requireAuth, focusEditor],
  );

  useEffect(() => {
    if (invalidMode) {
      console.error(
        "ReplyComposer received both reply props and realmUnitIds.",
      );
    }
  }, [invalidMode]);

  useEffect(() => {
    if (!canAttachPoll && attachingPoll) setAttachingPoll(false);
  }, [attachingPoll, canAttachPoll]);

  useEffect(() => {
    if (isRealmPostMode && expanded) focusEditor();
  }, [expanded, focusEditor, isRealmPostMode]);

  const reset = () => {
    setBody("");
    setAttachingPoll(false);
    if (mode === "progressive") setExpanded(false);
  };

  /**
   * Attach-poll sequence: `PollComposer` has already minted the poll
   * (`useCreatePoll`); now create the post carrying `extra.poll.unitId`. This is
   * deliberately non-atomic — an orphan poll on post failure is acceptable: the
   * failure surfaces (the poll error inside `PollComposer`, the post error
   * below) and the minted poll stays reusable as a standalone unit.
   */
  const handlePollCreated = (poll: PollDTO) => {
    if (!authGuard.requireAuth()) return;
    const trimmed = body.trim();
    const activeRealmUnitIds = realmUnitIds ?? [];
    if (isRealmPostMode) {
      postMutation.mutate(
        {
          realmUnitIds: activeRealmUnitIds,
          tagIds: selectedTagIds,
          kind: PostKind.POST,
          content: markdownContentDoc(trimmed),
          extra: { poll: { unitId: poll.unitId } },
        },
        {
          onSuccess: (post) => {
            reset();
            onSubmitted?.(post);
          },
        },
      );
      return;
    }

    submitReply(markdownContentDoc(trimmed), { pollUnitId: poll.unitId });
  };

  const handleSubmit = () => {
    if (!authGuard.requireAuth()) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    const activeRealmUnitIds = realmUnitIds ?? [];
    if (isRealmPostMode) {
      postMutation.mutate(
        {
          realmUnitIds: activeRealmUnitIds,
          tagIds: selectedTagIds,
          kind: PostKind.POST,
          content: markdownContentDoc(trimmed),
        },
        {
          onSuccess: (post) => {
            reset();
            onSubmitted?.(post);
          },
        },
      );
      return;
    }

    submitReply(markdownContentDoc(trimmed));
  };

  const handleCancel = () => {
    if (shouldRetainOnBlur()) return;
    reset();
    onCancelled?.();
  };

  const handleProgressiveFocus = () => {
    if (!authGuard.requireAuth()) return;
    setExpanded(true);
  };

  if (invalidMode || invalidCommentReplyMode) {
    return (
      <div className="rounded-md bg-error-fill/10 p-3 text-sm leading-ui text-error-text">
        {t("community:post_composer_invalid_configuration")}
      </div>
    );
  }

  if (mode === "progressive" && !expanded) {
    return (
      <>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: this only prevents parent row click propagation around the input. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: the wrapper itself is not an activation target. */}
        <div ref={triggerRef} onClick={(e) => e.stopPropagation()}>
          <Input
            placeholder={placeholder}
            onFocus={handleProgressiveFocus}
            onClick={handleProgressiveFocus}
          />
        </div>
        {authGuard.AuthModal({})}
      </>
    );
  }

  if (!authGuard.isAuthenticated) {
    return (
      <>
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-subtle p-4">
          <p className="text-sm leading-ui text-text-secondary">
            {t("entity:shelf_discussion_signInPrompt")}
          </p>
          <Button size="sm" onClick={authGuard.openLogin}>
            {t("auth:login")}
          </Button>
        </div>
        {authGuard.AuthModal({})}
      </>
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: this only prevents parent row click propagation around the editor.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the wrapper itself is not an activation target.
    <div
      ref={triggerRef}
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col gap-2"
    >
      <RezicsMarkdownEditor value={body} onChange={setBody} resize={resize} />
      {isRealmPostMode && (realmUnitIds?.length ?? 0) > 0 && (
        <RealmPostTagPicker
          realmUnitIds={realmUnitIds ?? []}
          tagIds={initialTagIds}
          selectedTagIds={selectedTagIds}
          onSelectedTagIdsChange={setSelectedTagIds}
        />
      )}
      <div className="flex flex-row items-center justify-between gap-2">
        {canAttachPoll ? (
          <Button
            size="sm"
            variant={attachingPoll ? "secondary" : "ghost"}
            onClick={() => setAttachingPoll((value) => !value)}
            disabled={submitting}
          >
            <BarChart3 className="mr-1 h-4 w-4" />
            {t("community:poll_attach")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-row gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={submitting}
          >
            {t("common:cancel")}
          </Button>
          {!attachingPoll && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !body.trim()}
            >
              {submitting
                ? t("community:post_composer_posting")
                : isRealmPostMode
                  ? t("community:post_composer_post")
                  : t("common:reply")}
            </Button>
          )}
        </div>
      </div>
      {attachingPoll && (
        <div className="rounded-md border border-border-whisper bg-surface-subtle p-4">
          <PollComposer
            submitLabel={t("community:poll_attach_submit")}
            onCreated={handlePollCreated}
          />
        </div>
      )}
      {(postMutation.isError || commentMutation.isError) && (
        <p className="text-sm leading-ui text-error-text">
          {t("community:poll_attach_error")}
        </p>
      )}
      {authGuard.AuthModal({})}
    </div>
  );
});
