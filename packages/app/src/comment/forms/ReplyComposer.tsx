import { useCreateCommentMutation } from "@rezics/contract/api/comment/comment";
import { useCreatePostMutation } from "@rezics/contract/api/post/post";
import { realmDetailQuery } from "@rezics/contract/api/realm/realm";
import {
  CONTENT_LANGUAGE_SLUGS,
  type CommentDTO,
  LANGUAGE_META,
  markdownContentDoc,
  markdownContentDocWithPoll,
  type PollDTO,
  type PostDTO,
  PostKind,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Link2 } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { PollComposer, PollLibrarySurface } from "@/poll";
import { RealmPostTagPicker } from "@/realm";
import { useAutoDetectedAuthoringLanguageState } from "@/shared/hooks/useAuthoringLanguageDefault";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { useAuthGuard } from "@/user";

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
  /**
   * Comment write context, mirroring `CreateCommentInput.realmUnitId`:
   * `null` is a direct comment, a string is a realm-context comment. When
   * `parentCommentId` is set it must be provided explicitly (replies pass
   * the parent's context; the server rejects a mismatch).
   * 评论写入语境，对应 `CreateCommentInput.realmUnitId`：`null` 为直接
   * 评论，字符串为 realm 语境评论。设置了 `parentCommentId` 时必须显式
   * 提供（回复传入父评论的语境；不一致会被服务端拒绝）。
   */
  realmUnitId?: string | null;
  parentCommentId?: string;
  realmUnitIds?: never;
  tagIds?: string[];
};

export type ReplyComposerRealmPostModeProps = ReplyComposerBaseProps & {
  realmUnitIds: string[];
  tagIds?: string[];
  targetUnitId?: never;
  parentCommentId?: never;
};

export type ReplyComposerProps =
  | ReplyComposerReplyModeProps
  | ReplyComposerRealmPostModeProps;

/**
 * Lightweight inline composer for replies and simple contextual posts. Realm
 * page-level authoring owns wiki creation, draft publishing, and existing
 * content submission outside this component.
 * 用于回复和简单上下文帖子的轻量内联编辑器。realm 页面级别的创作在本组件之外
 * 负责 wiki 创建、草稿发布以及已有内容的提交。
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
  const parentCommentId = isRealmPostMode ? undefined : props.parentCommentId;
  const isCommentReplyMode = !isRealmPostMode && Boolean(parentCommentId);
  const canAttachPoll = !isCommentReplyMode;
  const initialTagIds = props.tagIds;
  const invalidMode =
    Boolean(realmUnitIds?.length) &&
    Boolean(
      (props as Partial<ReplyComposerReplyModeProps>).targetUnitId ||
        (props as Partial<ReplyComposerReplyModeProps>).parentCommentId,
    );
  // `null` is a valid write target (direct comment); only an absent value
  // is a wiring error now that `CreateCommentInput.realmUnitId` is
  // required-nullable.
  // `null` 是合法的写入目标（直接评论）；既然 `CreateCommentInput.realmUnitId`
  // 已是必填可空字段，只有缺失值才算接线错误。
  const invalidCommentReplyMode =
    isCommentReplyMode && (!rootUnitId || realmUnitId === undefined);
  // True replies (not the root-level composer, whose parent is the root
  // itself) inherit the parent comment's context server-side; surface it
  // read-only above the editor.
  // 真正的回复（而非父级即根的根级编辑器）在服务端继承父评论的语境；
  // 在编辑器上方以只读方式展示。
  const isInheritedContextReply =
    isCommentReplyMode && parentCommentId !== rootUnitId;
  const inheritedRealmUnitId = isInheritedContextReply
    ? (realmUnitId ?? null)
    : null;
  const inheritedRealmQuery = useQuery({
    ...realmDetailQuery(inheritedRealmUnitId ?? ""),
    enabled: Boolean(inheritedRealmUnitId),
  });
  const startsExpanded = mode === "expanded" || autoFocus;
  const [expanded, setExpanded] = useState<boolean>(startsExpanded);
  const [body, setBody] = useState("");
  const { language, setLanguage } = useAutoDetectedAuthoringLanguageState({
    text: body,
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initialTagIds ?? [],
  );
  const [attachingPoll, setAttachingPoll] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const shouldRetainOnBlur = useBlurRetain(body);
  const postMutation = useCreatePostMutation();
  const commentMutation = useCreateCommentMutation();
  const submitting = postMutation.isPending || commentMutation.isPending;
  const derivedTitle =
    body.trim().split(/\r?\n/, 1)[0]?.slice(0, 120) || "Post";
  const reset = () => {
    setBody("");
    setAttachingPoll(false);
    if (mode === "progressive") setExpanded(false);
  };

  const submitReply = (content: ReturnType<typeof markdownContentDoc>) => {
    if (parentCommentId) {
      if (!rootUnitId || realmUnitId === undefined) return;
      commentMutation.mutate(
        {
          rootUnitId,
          realmUnitId,
          parentCommentId:
            parentCommentId === rootUnitId ? undefined : parentCommentId,
          content,
          language,
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
        realmUnitIds,
        tagIds: selectedTagIds,
        kind: PostKind.POST,
        language,
        title: derivedTitle,
        content,
      },
      {
        onSuccess: (post) => {
          reset();
          onSubmitted?.(post);
        },
      },
    );
  };

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

  /**
   * Attach-poll sequence: `PollComposer` has already minted the poll
   * (`useCreatePoll`); now create the post with a poll content block. This is
   * deliberately non-atomic — an orphan poll on post failure is acceptable: the
   * failure surfaces (the poll error inside `PollComposer`, the post error
   * below) and the minted poll stays reusable as a standalone unit.
   * 附加投票流程：`PollComposer` 已经创建好投票（`useCreatePoll`）；现在创建带
   * 投票内容块的帖子。这里刻意不做原子操作——帖子失败时留下孤立投票是可接受的：
   * 失败会显现出来（`PollComposer` 内的投票错误、下方的帖子错误），且已创建的
   * 投票仍可作为独立单元复用。
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
          language,
          title: derivedTitle,
          content: markdownContentDocWithPoll(trimmed, poll.unitId),
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

    submitReply(markdownContentDocWithPoll(trimmed, poll.unitId));
  };

  const handleExistingPollSelected = (pollUnitId: string) => {
    if (!authGuard.requireAuth()) return;
    const trimmed = body.trim();
    const activeRealmUnitIds = realmUnitIds ?? [];
    if (isRealmPostMode) {
      postMutation.mutate(
        {
          realmUnitIds: activeRealmUnitIds,
          tagIds: selectedTagIds,
          kind: PostKind.POST,
          language,
          title: derivedTitle,
          content: markdownContentDocWithPoll(trimmed, pollUnitId),
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

    submitReply(markdownContentDocWithPoll(trimmed, pollUnitId));
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
          language,
          title: derivedTitle,
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
      {isInheritedContextReply ? (
        <p className="text-xs leading-ui text-text-tertiary">
          {t("community:comment_context_reply_in", {
            context: inheritedRealmUnitId
              ? (inheritedRealmQuery.data?.title ?? inheritedRealmUnitId)
              : t("community:comment_context_direct"),
          })}
        </p>
      ) : null}
      <RezicsMarkdownEditor value={body} onChange={setBody} resize={resize} />
      {isRealmPostMode && (realmUnitIds?.length ?? 0) > 0 && (
        <RealmPostTagPicker
          realmUnitIds={realmUnitIds ?? []}
          tagIds={initialTagIds}
          selectedTagIds={selectedTagIds}
          onSelectedTagIdsChange={setSelectedTagIds}
        />
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-row flex-wrap items-center gap-2">
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
          ) : null}
          <Select value={language} onValueChange={setLanguage}>
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
        <div className="flex flex-row justify-end gap-2">
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
          <Tabs defaultValue="existing">
            <TabsList>
              <TabsTrigger value="existing">
                {t("community:poll_attach_existing")}
              </TabsTrigger>
              <TabsTrigger value="new">
                {t("community:poll_attach_create_new")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="pt-3">
              <PollLibrarySurface
                renderAction={(poll) => (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleExistingPollSelected(poll.unitId)}
                    disabled={submitting || !body.trim()}
                  >
                    <Link2 className="mr-1 h-4 w-4" />
                    {t("community:poll_attach_existing_action")}
                  </Button>
                )}
              />
            </TabsContent>
            <TabsContent value="new" className="pt-3">
              <PollComposer
                submitLabel={t("community:poll_attach_submit")}
                onCreated={handlePollCreated}
              />
            </TabsContent>
          </Tabs>
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

/**
 * Blur-retain rule: if the body is empty, the composer should collapse on
 * blur; otherwise it retains the draft and stays expanded. Returning a
 * boolean here keeps the caller in charge of the actual open/closed state.
 * 失焦保留规则：若正文为空，编辑器应在失焦时折叠；否则保留草稿并保持展开。
 * 这里返回一个布尔值，让调用方掌控实际的展开/折叠状态。
 */
export function useBlurRetain(body: string) {
  return () => body.trim().length > 0;
}

function languageLabel(language: string): string {
  const meta = (LANGUAGE_META as Record<string, { nativeName?: string }>)[
    language
  ];
  return meta?.nativeName ? `${meta.nativeName} (${language})` : language;
}
