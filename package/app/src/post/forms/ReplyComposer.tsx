import { useCreatePostMutation } from "@rezics/api/post/post";
import { realmQueries } from "@rezics/api/realm/realm";
import { tagQueries } from "@rezics/api/tag/tag";
import { PostKind, type TagTreeNode } from "@rezics/contract";
import { Button, Input } from "@rezics/ui/shadcn";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useAuthGuard } from "@/user/hooks/useAuthGuard";

export type ReplyComposerMode = "progressive" | "expanded";

export type ReplyComposerHandle = {
  focus: () => void;
};

type ReplyComposerBaseProps = {
  mode: ReplyComposerMode;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitted?: () => void;
  onCancelled?: () => void;
};

export type ReplyComposerReplyModeProps = ReplyComposerBaseProps & {
  targetUnitId: string;
  parentPostUnitId?: string;
  realmUnitIds?: never;
  tagIds?: string[];
};

export type ReplyComposerRealmPostModeProps = ReplyComposerBaseProps & {
  realmUnitIds: string[];
  tagIds?: string[];
  targetUnitId?: never;
  parentPostUnitId?: never;
};

export type ReplyComposerProps =
  | ReplyComposerReplyModeProps
  | ReplyComposerRealmPostModeProps;

type TagOption = {
  tagId: string;
  label: string;
};

type TagSearchResult = {
  unitId?: string;
  tagUnitId?: string;
  label?: string;
  slug?: string;
};

/**
 * Blur-retain rule: if the body is empty, the composer should collapse on
 * blur; otherwise it retains the draft and stays expanded. Returning a
 * boolean here keeps the caller in charge of the actual open/closed state.
 */
export function useBlurRetain(body: string) {
  return useCallback(() => body.trim().length > 0, [body]);
}

function getTagLabel(tagId: string, label?: string) {
  return label?.trim() || tagId.slice(0, 8);
}

function tagTreeNodeKey(node: TagTreeNode, depth: number) {
  return `${depth}:${node.tagId ?? node.label ?? "node"}`;
}

function flattenTagTree(nodes: TagTreeNode[] | undefined): TagOption[] {
  const options: TagOption[] = [];

  const visit = (items: TagTreeNode[]) => {
    for (const item of items) {
      if (item.tagId && !item.disabled) {
        options.push({
          tagId: item.tagId,
          label: getTagLabel(item.tagId, item.label),
        });
      }
      if (item.children?.length) visit(item.children);
    }
  };

  visit(nodes ?? []);
  return options;
}

function RealmPostTagPicker({
  realmUnitIds,
  tagIds,
  selectedTagIds,
  onSelectedTagIdsChange,
}: {
  realmUnitIds: string[];
  tagIds?: string[];
  selectedTagIds: string[];
  onSelectedTagIdsChange: (tagIds: string[]) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const firstRealmId = realmUnitIds.length === 1 ? realmUnitIds[0] : undefined;
  const { data: realm } = useQuery({
    ...realmQueries.detail(firstRealmId ?? ""),
    enabled: Boolean(firstRealmId),
  });
  const tagTree = firstRealmId
    ? (realm?.extra?.tagTree as TagTreeNode[] | undefined)
    : undefined;
  const quickPicks = useMemo(() => flattenTagTree(tagTree), [tagTree]);
  const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);

  useEffect(() => {
    onSelectedTagIdsChange(tagIds ?? []);
  }, [onSelectedTagIdsChange, tagIds]);

  const trimmedSearch = searchTerm.trim();
  const { data: searchData, isLoading: isSearching } = useQuery(
    tagQueries.search(trimmedSearch),
  );
  const searchResults = useMemo(() => {
    return ((searchData?.tags ?? []) as TagSearchResult[])
      .map((tag) => {
        const tagId = tag.unitId ?? tag.tagUnitId;
        if (!tagId || selectedSet.has(tagId)) return null;
        return {
          tagId,
          label: getTagLabel(tagId, tag.label ?? tag.slug),
        };
      })
      .filter(Boolean) as TagOption[];
  }, [searchData?.tags, selectedSet]);

  const toggleTag = (tagId: string) => {
    const next = selectedSet.has(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    onSelectedTagIdsChange(next);
  };

  const selectedLabels = new Map<string, string>();
  for (const option of quickPicks) {
    selectedLabels.set(option.tagId, option.label);
  }
  for (const option of searchResults) {
    selectedLabels.set(option.tagId, option.label);
  }

  const renderNode = (node: TagTreeNode, depth = 0): React.ReactNode => {
    const children = node.children?.map((child) => (
      <div key={tagTreeNodeKey(child, depth + 1)}>
        {renderNode(child, depth + 1)}
      </div>
    ));

    if (node.disabled && !node.tagId) {
      return (
        <div className={depth > 0 ? "pl-3" : undefined}>
          {node.label && (
            <div className="px-1 pt-2 text-xs font-medium leading-dense text-text-tertiary">
              {node.label}
            </div>
          )}
          {children}
        </div>
      );
    }

    if (node.tagId) {
      const selected = selectedSet.has(node.tagId);
      return (
        <Button
          type="button"
          size="sm"
          variant={selected ? "default" : "secondary"}
          className="h-8"
          onClick={() => toggleTag(node.tagId!)}
        >
          {getTagLabel(node.tagId, node.label)}
        </Button>
      );
    }

    return children;
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
      {selectedTagIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTagIds.map((tagId) => (
            <Button
              key={tagId}
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => toggleTag(tagId)}
            >
              {selectedLabels.get(tagId) ?? getTagLabel(tagId)}
            </Button>
          ))}
        </div>
      )}

      {tagTree && tagTree.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tagTree.map((node) => (
            <div key={tagTreeNodeKey(node, 0)} className="contents">
              {renderNode(node)}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search tags"
        />
        {trimmedSearch && (
          <div className="flex flex-wrap gap-2">
            {isSearching ? (
              <span className="text-sm leading-ui text-text-secondary">
                Searching…
              </span>
            ) : searchResults.length > 0 ? (
              searchResults.map((tag) => (
                <Button
                  key={tag.tagId}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => toggleTag(tag.tagId)}
                >
                  {tag.label}
                </Button>
              ))
            ) : (
              <span className="text-sm leading-ui text-text-secondary">
                No matching tags
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const ReplyComposer = forwardRef<
  ReplyComposerHandle,
  ReplyComposerProps
>(function ReplyComposer(props, ref) {
  const { t } = useTranslation();
  const authGuard = useAuthGuard();
  const {
    mode,
    placeholder = "Add a reply…",
    autoFocus = false,
    onSubmitted,
    onCancelled,
  } = props;
  const isRealmPostMode = "realmUnitIds" in props;
  const realmUnitIds = isRealmPostMode ? props.realmUnitIds : undefined;
  const targetUnitId = isRealmPostMode ? undefined : props.targetUnitId;
  const parentPostUnitId = isRealmPostMode ? undefined : props.parentPostUnitId;
  const initialTagIds = props.tagIds;
  const invalidMode =
    Boolean(realmUnitIds?.length) &&
    Boolean(
      (props as Partial<ReplyComposerReplyModeProps>).targetUnitId ||
        (props as Partial<ReplyComposerReplyModeProps>).parentPostUnitId,
    );
  const startsExpanded = mode === "expanded" || autoFocus;
  const [expanded, setExpanded] = useState<boolean>(startsExpanded);
  const [body, setBody] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initialTagIds ?? [],
  );
  const triggerRef = useRef<HTMLDivElement>(null);
  const shouldRetainOnBlur = useBlurRetain(body);
  const mutation = useCreatePostMutation();

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
    if (isRealmPostMode && expanded) focusEditor();
  }, [expanded, focusEditor, isRealmPostMode]);

  const reset = () => {
    setBody("");
    if (mode === "progressive") setExpanded(false);
  };

  const handleSubmit = () => {
    if (!authGuard.requireAuth()) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    const activeRealmUnitIds = realmUnitIds ?? [];
    const payload = isRealmPostMode
      ? {
          realmUnitIds: activeRealmUnitIds,
          tagIds: selectedTagIds,
          kind: PostKind.POST,
          body: trimmed,
        }
      : {
          targetUnitId,
          parentPostUnitId,
          kind: PostKind.POST,
          body: trimmed,
        };

    mutation.mutate(payload, {
      onSuccess: () => {
        reset();
        onSubmitted?.();
      },
    });
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

  if (invalidMode) {
    return (
      <div className="rounded-md bg-error-fill/10 p-3 text-sm leading-ui text-error-text">
        Invalid composer configuration.
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
            {t("shelf.discussion.signInPrompt")}
          </p>
          <Button size="sm" onClick={authGuard.openLogin}>
            {t("auth.login")}
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
      <div className="flex flex-row justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={mutation.isPending || !body.trim()}
        >
          {mutation.isPending ? "Posting…" : isRealmPostMode ? "Post" : "Reply"}
        </Button>
      </div>
      {authGuard.AuthModal({})}
    </div>
  );
});
