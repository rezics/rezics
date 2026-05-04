import {
  bookQueries,
  useCreateBookMutation,
  useUpdateBookMutation,
} from "@rezics/api/book/book";
import {
  useDeleteTranslationMutation,
  useUpsertTranslationMutation,
} from "@rezics/api/unit/unit.mutations";
import type {
  BookDTO,
  CreateBookInput,
  UpdateBookInput,
} from "@rezics/contract";
import { DEFAULT_LANGUAGE, normalizeLanguage } from "@rezics/contract";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { AddTranslationDialog } from "../components/AddTranslationDialog";
import { BookExtraEditor } from "../components/Metadata/BookExtraEditor";
import {
  BookMetadataEditor,
  type BookMetadataValue,
} from "../components/Metadata/BookMetadataEditor";
import { SetSourceReleaseControl } from "../components/SetSourceReleaseControl";
import { TranslationFieldsEditor } from "../components/TranslationFieldsEditor";
import { TranslationLanguageBar } from "../components/TranslationLanguageBar";
import { TranslationSyncActions } from "../components/TranslationSyncActions";
import {
  ALL_LANGUAGES,
  type TranslationDraft,
  useBookTranslationEditor,
} from "../hooks/useBookTranslationEditor";
import { ChevronDown as ExpandMore } from "lucide-react";

function validatePublishURL(publishURL: string[]) {
  return publishURL.every((url) => url.startsWith("https://"));
}

type UpdateBookDialogState = {
  title: string;
  message: string;
  error?: boolean;
  showBookLink?: boolean;
  bookId?: string;
} | null;

const UpdateBookDialog: React.FC<{
  t: TFunction;
  open: boolean;
  onClose: () => void;
  state: UpdateBookDialogState;
}> = ({ t, open, onClose, state }) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.title}</DialogTitle>
        </DialogHeader>
        <Alert variant={state?.error ? "destructive" : "default"}>
          <AlertDescription>
            <p className="text-base">{state?.message}</p>
            <p className="text-base">
              {state?.showBookLink && state?.bookId && (
                <TextLink to="/book/$bookId" params={{ bookId: state.bookId }}>
                  {t("page.book_edit.info.dialog.view_book")}
                </TextLink>
              )}
            </p>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export interface BookEditMainPageProps {
  newBook?: boolean;
  pageTitle?: string;
}

/**
 * BookEditMainPage — multi-language book editor.
 *
 * Layout: book-level metadata (isbn/cover/etc.) is edited once and saved via
 * `updateBook`. Per-language fields (title/subtitle/summary/description) live
 * in `translations[]` and are saved via `upsertTranslation` keyed by the
 * language picked in the language bar.
 */
export const BookEditMainPage: React.FC<BookEditMainPageProps> = ({
  newBook = false,
  pageTitle,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const editParams = matchRoute({ to: "/book/$bookId/edit", fuzzy: false });
  const bookId = !newBook && editParams ? editParams.bookId : undefined;
  const { data, isLoading, error } = useQuery({
    ...bookQueries.detail(bookId ?? ""),
    enabled: !newBook && !!bookId,
  });
  const [metadataState, setMetadataState] =
    React.useState<BookMetadataValue | null>(null);
  const [updateBookErrorOpen, setUpdateBookErrorOpen] = React.useState(false);
  const [dialogState, setDialogState] =
    React.useState<UpdateBookDialogState>(null);
  const [extraOpen, setExtraOpen] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);

  const editor = useBookTranslationEditor(data);

  const metadata: BookMetadataValue = metadataState ?? data ?? {};

  const createBookMutation = useCreateBookMutation({
    onSuccess: (responseData) => {
      setDialogState({
        title: t("page.book_edit.info.toast.create_success_title"),
        message: t("page.book_edit.info.toast.create_success_message"),
        showBookLink: true,
        bookId: responseData.unitId,
      });
      setUpdateBookErrorOpen(true);
    },
    onError: (err) => {
      setDialogState({
        title: t("page.book_edit.info.toast.create_failed_title"),
        message: String(err || t("common.unknown_error")),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const updateBookMutation = useUpdateBookMutation({
    onSuccess: () => {
      setDialogState({
        title: t("page.book_edit.info.toast.update_success_title"),
        message: t("page.book_edit.info.toast.update_success_message"),
      });
      setUpdateBookErrorOpen(true);
    },
    onError: (err) => {
      setDialogState({
        title: t("page.book_edit.info.toast.update_failed_title"),
        message: String(err || t("common.unknown_error")),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const upsertTranslationMutation = useUpsertTranslationMutation({
    onError: (err) => {
      setDialogState({
        title: t("page.book_edit.info.toast.update_failed_title"),
        message: String(err || t("common.unknown_error")),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const deleteTranslationMutation = useDeleteTranslationMutation();

  async function handleSubmit() {
    const draft = editor.currentDraft;

    if (newBook || !bookId) {
      const createBookData: CreateBookInput = {
        isbn13: metadataState?.isbn13 ?? undefined,
        coverUrl: metadataState?.coverUrl ?? undefined,
        pageCount: metadataState?.pageCount ?? undefined,
        textLength: metadataState?.textLength,
        formatKey: metadataState?.formatKey ?? undefined,
        rating: metadataState?.rating,
        isLicensed: metadataState?.isLicensed,
        extra: metadataState?.extra,
        defaultLanguage: DEFAULT_LANGUAGE,
        translations: [
          {
            language:
              normalizeLanguage(editor.selectedLanguage) ?? DEFAULT_LANGUAGE,
            title: draft.title || undefined,
            subtitle: draft.subtitle || undefined,
            summary: draft.summary || undefined,
            description: draft.description || undefined,
          },
        ],
      };
      const publishURL = metadataState?.extra?.publishURL;
      if (
        createBookData.isLicensed ||
        (publishURL && validatePublishURL(publishURL))
      ) {
        await createBookMutation.mutateAsync(createBookData);
      } else {
        setDialogState({
          title: t("page.book_edit.info.toast.create_failed_title"),
          message: t("page.book_edit.info.validation.publish_url_required"),
          error: true,
        });
        setUpdateBookErrorOpen(true);
      }
      return;
    }

    const updateBookData: UpdateBookInput = {
      isbn13: metadataState?.isbn13,
      coverUrl: metadataState?.coverUrl,
      pageCount: metadataState?.pageCount,
      textLength: metadataState?.textLength,
      formatKey: metadataState?.formatKey,
      rating: metadataState?.rating,
      isLicensed: metadataState?.isLicensed,
      extra: metadataState?.extra,
    };

    await Promise.all([
      updateBookMutation.mutateAsync({ unitId: bookId, input: updateBookData }),
      upsertTranslationMutation.mutateAsync({
        unitId: bookId,
        language: editor.selectedLanguage,
        input: {
          title: draft.title || null,
          subtitle: draft.subtitle || null,
          summary: draft.summary || null,
          description: draft.description || null,
        },
      }),
    ]);
    editor.clearDraft(editor.selectedLanguage);
  }

  function handleAddTranslation(params: {
    language: string;
    sourceReleaseUnitId: string | null;
  }) {
    if (!bookId) return;
    upsertTranslationMutation.mutate(
      {
        unitId: bookId,
        language: params.language,
        input: {
          sourceReleaseUnitId: params.sourceReleaseUnitId ?? undefined,
        },
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          editor.setSelectedLanguage(params.language);
        },
      },
    );
  }

  function handleDeleteCurrentTranslation() {
    if (!bookId) return;
    if (!editor.currentTranslation) return;
    if (
      !window.confirm(
        t("page.book_edit.info.translation.delete_confirm", {
          lang: editor.selectedLanguage,
        }),
      )
    )
      return;
    deleteTranslationMutation.mutate(
      { unitId: bookId, language: editor.selectedLanguage },
      {
        onSuccess: () => {
          editor.clearDraft(editor.selectedLanguage);
        },
      },
    );
  }

  if (isLoading)
    return (
      <div className="mt-16 mx-auto max-w-3xl px-4 text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  if (error)
    return (
      <div className="mt-16 mx-auto max-w-3xl px-4">
        <QueryErrorDisplay error={error} />
      </div>
    );
  if (!data && !newBook)
    return (
      <div className="mt-16 mx-auto max-w-3xl px-4 text-muted-foreground">
        {t("common.no_data")}
      </div>
    );

  const resolvedPageTitle = pageTitle ?? t("page.book_edit.info.title");
  const sourceReleaseUnitId = editor.currentTranslation?.sourceReleaseUnitId;
  const hasAvailable =
    ALL_LANGUAGES.length > editor.existingLanguages.length;

  return (
    <div className="mt-16 mx-auto max-w-3xl px-4 pb-16">
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-2xl font-bold">{resolvedPageTitle}</h1>
        <div className="flex items-center gap-2">
          {bookId && (
            <Button
              variant="outline"
              onClick={() =>
                navigate({ to: "/book/$bookId", params: { bookId } })
              }
            >
              {t("common.back")}
            </Button>
          )}
          <Button onClick={() => handleSubmit()}>{t("common.submit")}</Button>
        </div>
      </div>

      <div className="space-y-16">
        {/* Translation: language bar + per-language fields + sync actions */}
        {!newBook && data && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("page.book_edit.info.translation.section_title")}
            </h3>
            <Separator className="mb-6" />
            <div className="flex flex-col gap-8">
              <TranslationLanguageBar
                existingLanguages={editor.existingLanguages}
                selectedLanguage={editor.selectedLanguage}
                defaultLanguage={data.defaultLanguage}
                onSelect={editor.setSelectedLanguage}
                onAddClick={() => setAddOpen(true)}
                hasAvailable={hasAvailable}
              />

              {!editor.currentTranslation && (
                <Alert>
                  <AlertDescription>
                    {t("page.book_edit.info.translation.empty_for_lang", {
                      lang: editor.selectedLanguage,
                    })}
                  </AlertDescription>
                </Alert>
              )}

              <TranslationFieldsEditor
                draft={editor.currentDraft}
                onChange={editor.updateField}
              />

              <SetSourceReleaseControl
                book={data}
                language={editor.selectedLanguage}
                currentSourceReleaseUnitId={sourceReleaseUnitId}
              />

              {editor.isDirty && sourceReleaseUnitId && (
                <Alert>
                  <AlertDescription>
                    {t("page.book_edit.info.translation.diverge_warning")}
                  </AlertDescription>
                </Alert>
              )}

              <TranslationSyncActions
                sourceReleaseUnitId={sourceReleaseUnitId}
                language={editor.selectedLanguage}
                onSync={(draft: TranslationDraft) =>
                  editor.replaceDraft(editor.selectedLanguage, draft)
                }
              />

              {editor.currentTranslation && editor.existingLanguages.length > 1 && (
                <div className="flex flex-row justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-error-text"
                    onClick={handleDeleteCurrentTranslation}
                  >
                    {t("page.book_edit.info.translation.delete_button")}
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* For newBook flow: just show one language's fields, no language bar yet */}
        {newBook && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("page.book_edit.info.translation.section_title")}
            </h3>
            <Separator className="mb-6" />
            <TranslationFieldsEditor
              draft={editor.currentDraft}
              onChange={editor.updateField}
            />
          </section>
        )}

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("book.edit_sections.metadata")}
          </h3>
          <Separator className="mb-6" />
          <BookMetadataEditor
            value={metadata}
            onChange={(value) => {
              setMetadataState((prev) => ({
                ...(prev ?? data ?? {}),
                ...value,
              }));
            }}
          />
        </section>

        <section>
          <button
            type="button"
            className="flex items-center justify-between w-full group"
            onClick={() => setExtraOpen((o) => !o)}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("book.edit_sections.extra")}
            </h3>
            <ExpandMore
              className="w-5 h-5 text-text-secondary transition-transform duration-200"
              style={{
                transform: extraOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>
          <Separator className="mt-3 mb-6" />
          {extraOpen && (
            <BookExtraEditor
              value={metadata.extra}
              onChange={(value) => {
                setMetadataState((prev) => ({ ...prev, extra: value }));
              }}
            />
          )}
        </section>
      </div>

      <AddTranslationDialog
        open={addOpen}
        book={data}
        existingLanguages={editor.existingLanguages}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddTranslation}
      />

      <UpdateBookDialog
        t={t}
        open={updateBookErrorOpen}
        onClose={() => setUpdateBookErrorOpen(false)}
        state={dialogState}
      />
    </div>
  );
};
