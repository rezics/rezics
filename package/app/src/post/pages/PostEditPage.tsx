import { getLockedFieldError } from "@rezics/api";
import {
  postQueries,
  useUpdatePostMutation,
  useUpdateWikiPostContentMutation,
} from "@rezics/api/post/post";
import {
  mainMarkdownSource,
  markdownContentDoc,
  PostKind,
} from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Alert, AlertDescription, Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";

export interface PostEditPageProps {
  postUnitId: string;
  returnTo: string;
}

export function PostEditPage({ postUnitId, returnTo }: PostEditPageProps) {
  const { t } = useTranslation(["common", "community"]);
  const locale = useLocale();
  const navigate = useNavigate();
  const {
    data: post,
    isLoading,
    error,
  } = useQuery(postQueries.detail(postUnitId));
  const [text, setText] = useState("");
  const [lockedError, setLockedError] = useState<string | null>(null);
  const isWikiPost = post?.kind === PostKind.WIKI;

  useEffect(() => {
    if (post) setText(mainMarkdownSource(post.content) ?? "");
  }, [post]);

  const handleSaved = () => {
    navigate({ to: returnTo });
  };

  const updateMutation = useUpdatePostMutation({ onSuccess: handleSaved });
  const updateWikiMutation = useUpdateWikiPostContentMutation({
    onSuccess: handleSaved,
    onError: (err) => {
      const locked = getLockedFieldError(err);
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
    if (!post || !text.trim()) return;
    setLockedError(null);
    const content = markdownContentDoc(text.trim());
    if (isWikiPost) {
      updateWikiMutation.mutate({
        unitId: post.unitId,
        content,
        language: locale,
      });
      return;
    }
    updateMutation.mutate({
      unitId: post.unitId,
      input: { patch: { post: { content } } },
    });
  };

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;
  if (!post) return null;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
      {lockedError ? (
        <Alert variant="destructive">
          <AlertDescription>{lockedError}</AlertDescription>
        </Alert>
      ) : null}
      {isWikiPost ? (
        <h1 className="text-lg font-medium leading-ui text-text-primary">
          {t("community:post_edit_wiki_post")}
        </h1>
      ) : null}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={14}
        className="min-h-[22rem] w-full rounded-md border border-border-whisper bg-transparent px-3 py-2 text-sm leading-body shadow-xs outline-none focus-visible:border-border-focus focus-visible:ring-[3px] focus-visible:ring-border-focus/30"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate({ to: returnTo })}>
          {t("common:cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={activeMutation.isPending || !text.trim()}
        >
          {activeMutation.isPending ? t("common:saving") : t("common:save")}
        </Button>
      </div>
    </section>
  );
}

export default PostEditPage;
