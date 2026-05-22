import {
  bookQueries,
  useCreateBookMutation,
  useUpdateBookMutation,
} from "@rezics/api/book/book";
import { historyQueries } from "@rezics/api";
import {
  useDeleteTranslationMutation,
  useUpsertTranslationMutation,
} from "@rezics/api/unit/unit.mutations";
import { useLinkCreditAttributionMutation } from "@rezics/api/credit-attribution/credit-attribution";
import type {
  CreateBookInput,
  CreationMode,
  UpdateBookInput,
} from "@rezics/contract";
import {
  CreationMode as CreationModeValue,
  DEFAULT_LANGUAGE,
  normalizeLanguage,
} from "@rezics/contract";
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
import { useMatchRoute, useNavigate, useSearch } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { ChevronDown as ExpandMore, Plus } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { EntityPicker } from "@/entity-picker";
import { resolvePublicationLicenseDefault } from "@/shared/utils/publication-license";
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

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
  const search = useSearch({ strict: false }) as {
    lang?: string;
    restoreRevision?: string;
  };
  const matchRoute = useMatchRoute();
  const editParams = matchRoute({ to: "/book/$bookId/edit", fuzzy: false });
  const bookId = !newBook && editParams ? editParams.bookId : undefined;
  const restoreSequence = Number(search.restoreRevision);
  const { data, isLoading, error } = useQuery({
    ...bookQueries.detail(bookId ?? ""),
    enabled: !newBook && !!bookId,
  });
  const restoreQuery = useQuery({
    ...historyQueries.unitRevision(bookId ?? "", restoreSequence, {
      includeContent: true,
    }),
    enabled: !newBook && !!bookId && Number.isFinite(restoreSequence),
  });
  const [metadataState, setMetadataState] =
    React.useState<BookMetadataValue | null>(null);
  const [appliedRestoreSequence, setAppliedRestoreSequence] = React.useState<
    number | null
  >(null);
  const [updateBookErrorOpen, setUpdateBookErrorOpen] = React.useState(false);
  const [dialogState, setDialogState] =
    React.useState<UpdateBookDialogState>(null);
  const [extraOpen, setExtraOpen] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);
  const [authorPickerOpen, setAuthorPickerOpen] = React.useState(false);
  const [creationMode, setCreationMode] = React.useState<CreationMode>(
    CreationModeValue.WIKI,
  );

  const editor = useBookTranslationEditor(data);

  const metadata: BookMetadataValue = metadataState ?? data ?? {};

  React.useEffect(() => {
    if (!data) return;
    if (!Number.isFinite(restoreSequence)) return;
    if (appliedRestoreSequence === restoreSequence) return;
    const payload = restoreQuery.data?.revision.content?.payload;
    if (!payload) return;

    const slots = asRecord(payload);
    const extension = asRecord(slots.extension);
    const bookExtension = asRecord(extension.book ?? extension);
    setMetadataState({
      ...data,
      isbn13: nullableString(bookExtension.isbn13) ?? data.isbn13,
      coverUrl: nullableString(bookExtension.coverUrl) ?? data.coverUrl,
      pageCount: nullableNumber(bookExtension.pageCount) ?? data.pageCount,
      textLength: nullableNumber(bookExtension.textLength) ?? data.textLength,
      formatKey: nullableString(bookExtension.formatKey) ?? data.formatKey,
      isLicensed:
        typeof bookExtension.isLicensed === "boolean"
          ? bookExtension.isLicensed
          : data.isLicensed,
      licenseSlug:
        nullableString(bookExtension.licenseSlug) ?? data.licenseSlug,
      rating: nullableString(bookExtension.rating) ?? data.rating,
      extra: asRecordOrNull(bookExtension.extra) ?? data.extra,
    });

    const translations = Array.isArray(slots.translations)
      ? slots.translations
      : [];
    for (const item of translations) {
      const translation = asRecord(item);
      const language = String(translation.language ?? "");
      if (!language) continue;
      editor.replaceDraft(language, {
        title: String(translation.title ?? ""),
        subtitle: String(translation.subtitle ?? ""),
        summary: String(translation.summary ?? ""),
        description: String(translation.description ?? ""),
      });
    }
    const firstLanguage = asRecord(translations[0]).language;
    if (typeof firstLanguage === "string") {
      editor.setSelectedLanguage(firstLanguage);
    }
    setAppliedRestoreSequence(restoreSequence);
  }, [
    appliedRestoreSequence,
    data,
    editor,
    restoreQuery.data?.revision.content?.payload,
    restoreSequence,
  ]);

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
  const linkAuthorMutation = useLinkCreditAttributionMutation();

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
        licenseSlug: resolvePublicationLicenseDefault({
          explicitSelection: metadataState?.licenseSlug,
        }),
        extra: metadataState?.extra,
        defaultLanguage: DEFAULT_LANGUAGE,
        creationMode,
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
      licenseSlug: metadataState?.licenseSlug,
      extra: metadataState?.extra,
    };

    const saveOperations: Promise<unknown>[] = [
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
    ];

    if (metadataState) {
      saveOperations.unshift(
        updateBookMutation.mutateAsync({
          unitId: bookId,
          input: updateBookData,
        }),
      );
    }

    await Promise.all(saveOperations);
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
  const hasAvailable = ALL_LANGUAGES.length > editor.existingLanguages.length;

  return (
    <div className="mt-16 mx-auto max-w-3xl px-4 pb-16">
      {Number.isFinite(restoreSequence) ? (
        <Alert className="mb-8">
          <AlertDescription>
            {t(
              "history.restore.edit_notice",
              "This draft was loaded from revision {{sequence}}. Saving creates a new latest revision and keeps later history preserved.",
              { sequence: restoreSequence },
            )}
          </AlertDescription>
        </Alert>
      ) : null}
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
        {newBook && (
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Creation path
            </h3>
            <Separator className="mb-6" />
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-md border border-border-whisper p-4 text-left transition-colors ${
                  creationMode === CreationModeValue.WIKI
                    ? "bg-brand-fill text-text-on-brand"
                    : "bg-surface-subtle text-text-primary hover:bg-surface-elevated"
                }`}
                onClick={() => setCreationMode(CreationModeValue.WIKI)}
              >
                <span className="block text-sm font-medium leading-ui">
                  Catalog entry
                </span>
                <span className="mt-1 block text-xs leading-dense opacity-80">
                  Owned by the community catalog and open to collaborative
                  edits.
                </span>
              </button>
              <button
                type="button"
                className={`rounded-md border border-border-whisper p-4 text-left transition-colors ${
                  creationMode === CreationModeValue.PERSONAL
                    ? "bg-brand-fill text-text-on-brand"
                    : "bg-surface-subtle text-text-primary hover:bg-surface-elevated"
                }`}
                onClick={() => setCreationMode(CreationModeValue.PERSONAL)}
              >
                <span className="block text-sm font-medium leading-ui">
                  Personal work
                </span>
                <span className="mt-1 block text-xs leading-dense opacity-80">
                  Owned by your account and closed to community edits by
                  default.
                </span>
              </button>
            </div>
          </section>
        )}

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
                afterTitleSlot={
                  bookId ? (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={linkAuthorMutation.isPending}
                        onClick={() => setAuthorPickerOpen(true)}
                      >
                        <Plus className="size-4" />
                        {t("book.actions.add_author", "Add author")}
                      </Button>
                    </div>
                  ) : null
                }
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

              {editor.currentTranslation &&
                editor.existingLanguages.length > 1 && (
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
            bookUnitId={bookId}
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

      {bookId ? (
        <EntityPicker
          open={authorPickerOpen}
          onOpenChange={setAuthorPickerOpen}
          creationContext="catalog"
          lockedCreditRole="author"
          onSelect={(entityId) => {
            linkAuthorMutation.mutate({
              unitId: bookId,
              entityId,
              role: "author",
            });
          }}
        />
      ) : null}

      <UpdateBookDialog
        t={t}
        open={updateBookErrorOpen}
        onClose={() => setUpdateBookErrorOpen(false)}
        state={dialogState}
      />
    </div>
  );
};
