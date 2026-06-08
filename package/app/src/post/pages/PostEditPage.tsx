import { getLockedFieldError } from "@rezics/api";
import {
  postQueries,
  useUpdatePostMutation,
  useUpdateWikiPostContentMutation,
} from "@rezics/api/post/post";
import { unitQueries } from "@rezics/api/unit/unit";
import {
  mainMarkdownSource,
  markdownContentDoc,
  normalizeLanguage,
  PostKind,
} from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { Alert, AlertDescription, Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";
import { PostEditorSurface } from "../forms/PostEditorSurface";
import { isPostEditorSurfaceSubmittable } from "../models/postEditorSurface";

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
  const { data: languageContent, isLoading: isLanguageContentLoading } =
    useQuery(unitQueries.languageContent(postUnitId, { appLocale: locale }));
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [language, setLanguage] = useState(locale);
  const [lockedError, setLockedError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isWikiPost = post?.kind === PostKind.WIKI;

  useEffect(() => {
    if (!post || !languageContent) return;
    setTitle(languageContent.title ?? "");
    setText(mainMarkdownSource(languageContent.content) ?? "");
    setLanguage(normalizeLanguage(languageContent.resolvedLanguage) ?? locale);
  }, [languageContent, locale, post]);

  const handleSaved = () => {
    toast.success("Saved.");
    navigate({ to: returnTo });
  };

  const handleSaveError = (err: Error) => {
    const locked = getLockedFieldError(err);
    if (locked) {
      setLockedError(
        locked.offendingLockPath && locked.offendingPatchPath
          ? `Locked path: ${locked.offendingLockPath}; patch path: ${locked.offendingPatchPath}`
          : locked.blockedPaths.length
            ? `Locked paths: ${locked.blockedPaths.join(", ")}`
            : locked.message,
      );
      return;
    }
    setSaveError(err.message);
    toast.error(err.message);
  };

  const updateMutation = useUpdatePostMutation({
    onSuccess: handleSaved,
    onError: handleSaveError,
  });
  const updateWikiMutation = useUpdateWikiPostContentMutation({
    onSuccess: handleSaved,
    onError: handleSaveError,
  });
  const activeMutation = isWikiPost ? updateWikiMutation : updateMutation;
  const validationMessage = !isPostEditorSurfaceSubmittable({
    title,
    body: text,
  })
    ? t("common:required")
    : null;

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!post || !isPostEditorSurfaceSubmittable({ title, body: text })) return;
    setLockedError(null);
    setSaveError(null);
    const content = markdownContentDoc(text.trim());
    if (isWikiPost) {
      updateWikiMutation.mutate({
        unitId: post.unitId,
        title: trimmedTitle === post.title ? undefined : trimmedTitle,
        content,
        language,
      });
      return;
    }
    updateMutation.mutate({
      unitId: post.unitId,
      input: {
        patch: {
          post: {
            title: trimmedTitle === post.title ? undefined : trimmedTitle,
            content,
            language,
          },
        },
      },
    });
  };

  if (isLoading || isLanguageContentLoading)
    return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;
  if (!post) return null;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
      {lockedError || saveError ? (
        <Alert variant="destructive">
          <AlertDescription>{lockedError ?? saveError}</AlertDescription>
        </Alert>
      ) : null}
      {isWikiPost ? (
        <h1 className="text-lg font-medium leading-ui text-text-primary">
          {t("community:post_edit_wiki_post")}
        </h1>
      ) : null}
      <PostEditorSurface
        post={post}
        language={language}
        defaultLanguage={locale}
        title={title}
        body={text}
        onLanguageChange={(nextLanguage) =>
          setLanguage(normalizeLanguage(nextLanguage) ?? locale)
        }
        onTitleChange={setTitle}
        onBodyChange={setText}
        titlePlaceholder={t("community:post_title_placeholder")}
        disabled={activeMutation.isPending}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate({ to: returnTo })}>
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
      </div>
    </section>
  );
}
