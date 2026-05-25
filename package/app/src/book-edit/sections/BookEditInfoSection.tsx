import { historyQueries, unitAuthorityQueries } from "@rezics/api";
import {
  bookKeys,
  bookQueries,
  useCreateBookMutation,
  useUpdateBookMutation,
} from "@rezics/api/book/book";
import { creditAttributionQueries } from "@rezics/api/credit-attribution/credit-attribution";
import { useEntityAttributionBatchMutation } from "@rezics/api/entity-attribution/entity-attribution";
import { getLockedFieldError } from "@rezics/api/react-query/errors";
import {
  useDeleteTranslationMutation,
  useUpsertTranslationMutation,
} from "@rezics/api/unit/unit.mutations";
import type {
  ContentRating,
  CreateBookInput,
  CreationMode,
  EditorialPatchSubmission,
  LicenseSlug,
  UnitFieldLockDTO,
} from "@rezics/contract";
import {
  CreationMode as CreationModeValue,
  DEFAULT_LANGUAGE,
  UNIT_FIELD_LOCK_ALL,
  lockPathIntersectsPatchPath,
  mainMarkdownSource,
  markdownContentDoc,
  normalizeLanguage,
} from "@rezics/contract";
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
import { ChevronDown as ExpandMore, LockKeyhole, Plus } from "lucide-react";
import React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { EntityPicker } from "@/entity-picker";
import { TextLink } from "@/shared/ui/link";
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
import {
  isRestoreEditSubmitDisabled,
  withRestoreSource,
} from "../models/restoreEdit";
import { editorialPathLabel } from "@/unit/models/lockFieldLabels";
import {
  authority_edit_form_all_locked_notice,
  authority_edit_form_locked_error,
  authority_edit_form_locked_notice,
  authority_edit_form_privileged_notice,
  book_actions_add_author,
  book_edit_sections_extra,
  book_edit_sections_metadata,
  common_back,
  common_close,
  common_loading,
  common_no_data,
  common_submit,
  common_unknown_error,
  history_restore_edit_content_missing,
  history_restore_edit_load_failed,
  history_restore_edit_notice,
  history_restore_edit_unavailable_description,
  history_restore_edit_unavailable_title,
  page_book_edit_info_dialog_view_book,
  page_book_edit_info_title,
  page_book_edit_info_toast_create_failed_title,
  page_book_edit_info_toast_create_success_message,
  page_book_edit_info_toast_create_success_title,
  page_book_edit_info_toast_update_failed_title,
  page_book_edit_info_toast_update_success_message,
  page_book_edit_info_toast_update_success_title,
  page_book_edit_info_translation_delete_button,
  page_book_edit_info_translation_delete_confirm,
  page_book_edit_info_translation_diverge_warning,
  page_book_edit_info_translation_empty_for_lang,
  page_book_edit_info_translation_section_title,
  page_book_edit_info_validation_publish_url_required,
} from "@rezics/i18n/messages";

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

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function lockedFieldMessage(error: unknown) {
  const locked = getLockedFieldError(error);
  if (!locked) return null;
  const paths =
    locked.blockedPaths.length > 0
      ? locked.blockedPaths.map(editorialPathLabel).join(", ")
      : locked.message;
  return authority_edit_form_locked_error({ paths });
}

function matchingLocks(
  locks: readonly UnitFieldLockDTO[] | undefined,
  paths: readonly string[],
) {
  if (!locks?.length) return [];
  return locks.filter((lock) =>
    paths.some((path) => lockPathIntersectsPatchPath(lock.path, path)),
  );
}

function LockedFieldNotice({
  locks,
  paths,
}: {
  locks: readonly UnitFieldLockDTO[] | undefined;
  paths: readonly string[];
}) {
  const matched = matchingLocks(locks, paths);
  if (matched.length === 0) return null;

  const allFieldsLocked = matched.some(
    (lock) => lock.path === UNIT_FIELD_LOCK_ALL,
  );

  return (
    <Alert>
      <LockKeyhole className="size-4" aria-hidden="true" />
      <AlertDescription>
        <span className="block text-sm leading-ui">
          {allFieldsLocked
            ? authority_edit_form_all_locked_notice()
            : authority_edit_form_locked_notice({
                fields: matched
                  .map((lock) => editorialPathLabel(lock.path))
                  .join(", "),
              })}
        </span>
        <span className="mt-1 block text-xs leading-dense text-text-secondary">
          {authority_edit_form_privileged_notice()}
        </span>
      </AlertDescription>
    </Alert>
  );
}

const UpdateBookDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  state: UpdateBookDialogState;
}> = ({ open, onClose, state }) => {
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
                  {page_book_edit_info_dialog_view_book()}
                </TextLink>
              )}
            </p>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button onClick={onClose}>{common_close()}</Button>
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
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    lang?: string;
    restoreRevision?: string;
  };
  const matchRoute = useMatchRoute();
  const editParams = matchRoute({ to: "/book/$bookId/edit", fuzzy: false });
  const bookId = !newBook && editParams ? editParams.bookId : undefined;
  const hasRestoreRevision =
    search.restoreRevision !== undefined && search.restoreRevision !== "";
  const restoreSequence = Number(search.restoreRevision);
  const isRestoreMode = hasRestoreRevision && Number.isFinite(restoreSequence);
  const { data, isLoading, error } = useQuery({
    ...bookQueries.detail(bookId ?? ""),
    enabled: !newBook && !!bookId,
  });
  const restoreQuery = useQuery({
    ...historyQueries.unitRevision(bookId ?? "", restoreSequence, {
      includeContent: true,
    }),
    enabled: !newBook && !!bookId && isRestoreMode,
  });
  const authorCreditsQuery = useQuery({
    ...creditAttributionQueries.byUnit(bookId ?? ""),
    enabled: !newBook && !!bookId,
  });
  const fieldLocksQuery = useQuery({
    ...unitAuthorityQueries.fieldLocks(bookId ?? ""),
    enabled: !newBook && !!bookId,
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
  const restoreContentPayload = asRecordOrNull(
    restoreQuery.data?.revision.content?.payload,
  );
  const restoreSubmitDisabled = isRestoreEditSubmitDisabled({
    isRestoreMode,
    isLoading: restoreQuery.isLoading,
    hasError: !!restoreQuery.error,
    hasContentPayload: !!restoreContentPayload,
  });
  const canAttachRestoreSource = isRestoreMode && !restoreSubmitDisabled;

  React.useEffect(() => {
    if (!data) return;
    if (!isRestoreMode) return;
    if (appliedRestoreSequence === restoreSequence) return;

    if (!restoreContentPayload) return;

    const patch = restoreContentPayload;
    const extension = asRecord(patch.extension);
    const bookExtension = asRecord(extension.book ?? extension);
    const unitPatch = asRecord(patch.unit);
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
        (nullableString(unitPatch.license ?? bookExtension.licenseSlug) as
          | LicenseSlug
          | null
          | undefined) ?? data.licenseSlug,
      rating:
        (nullableString(unitPatch.rating ?? bookExtension.rating) as
          | ContentRating
          | undefined) ?? data.rating,
      extra: asRecordOrNull(bookExtension.extra) ?? data.extra,
    });

    const translations = Array.isArray(patch.translations)
      ? patch.translations
      : Object.entries(asRecord(patch.translations)).map(
          ([language, value]) => ({
            language,
            ...asRecord(value),
          }),
        );
    for (const item of translations) {
      const translation = asRecord(item);
      const language = String(translation.language ?? "");
      if (!language) continue;
      editor.replaceDraft(language, {
        title: String(translation.title ?? ""),
        subtitle: String(translation.subtitle ?? ""),
        summary: String(translation.summary ?? ""),
        description: mainMarkdownSource(translation.description) ?? "",
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
    isRestoreMode,
    restoreContentPayload,
    restoreSequence,
  ]);

  const createBookMutation = useCreateBookMutation({
    onSuccess: (responseData) => {
      setDialogState({
        title: page_book_edit_info_toast_create_success_title(),
        message: page_book_edit_info_toast_create_success_message(),
        showBookLink: true,
        bookId: responseData.unitId,
      });
      setUpdateBookErrorOpen(true);
    },
    onError: (err) => {
      setDialogState({
        title: page_book_edit_info_toast_create_failed_title(),
        message: String(err || common_unknown_error()),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const updateBookMutation = useUpdateBookMutation({
    onSuccess: () => {
      setDialogState({
        title: page_book_edit_info_toast_update_success_title(),
        message: page_book_edit_info_toast_update_success_message(),
      });
      setUpdateBookErrorOpen(true);
    },
    onError: (err) => {
      setDialogState({
        title: page_book_edit_info_toast_update_failed_title(),
        message:
          lockedFieldMessage(err) ?? String(err || common_unknown_error()),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const upsertTranslationMutation = useUpsertTranslationMutation({
    affectedDetailKeys: () => (bookId ? [bookKeys.detail(bookId)] : []),
    onError: (err) => {
      setDialogState({
        title: page_book_edit_info_toast_update_failed_title(),
        message:
          lockedFieldMessage(err) ?? String(err || common_unknown_error()),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const deleteTranslationMutation = useDeleteTranslationMutation({
    affectedDetailKeys: () => (bookId ? [bookKeys.detail(bookId)] : []),
  });
  const batchAuthorMutation = useEntityAttributionBatchMutation();

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
            description: draft.description
              ? markdownContentDoc(draft.description)
              : undefined,
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
          title: page_book_edit_info_toast_create_failed_title(),
          message: page_book_edit_info_validation_publish_url_required(),
          error: true,
        });
        setUpdateBookErrorOpen(true);
      }
      return;
    }

    if (restoreSubmitDisabled) {
      setDialogState({
        title: history_restore_edit_unavailable_title(),
        message: history_restore_edit_unavailable_description(),
        error: true,
      });
      setUpdateBookErrorOpen(true);
      return;
    }

    const sourcePaths = restoreQuery.data?.revision.changedFieldKeys ?? [];
    const applyRestoreSource = (
      input: EditorialPatchSubmission,
    ): EditorialPatchSubmission => {
      return withRestoreSource(input, {
        enabled: canAttachRestoreSource,
        bookId,
        restoreSequence,
        sourcePaths,
      });
    };

    const metadataPatch: Record<string, unknown> = {};
    const extensionPatch: Record<string, unknown> = {};
    const unitPatch: Record<string, unknown> = {};
    if (metadataState && data) {
      if (metadataState.isbn13 !== data.isbn13)
        extensionPatch.isbn13 = metadataState.isbn13 ?? null;
      if (metadataState.coverUrl !== data.coverUrl)
        extensionPatch.coverUrl = metadataState.coverUrl ?? null;
      if (metadataState.pageCount !== data.pageCount)
        extensionPatch.pageCount = metadataState.pageCount ?? null;
      if (metadataState.textLength !== data.textLength)
        extensionPatch.textLength = metadataState.textLength;
      if (metadataState.formatKey !== data.formatKey)
        extensionPatch.formatKey = metadataState.formatKey ?? null;
      if (metadataState.isLicensed !== data.isLicensed)
        extensionPatch.isLicensed = metadataState.isLicensed;
      if (!sameJson(metadataState.extra, data.extra))
        extensionPatch.extra = metadataState.extra ?? null;
      if (metadataState.rating !== data.rating)
        unitPatch.rating = metadataState.rating;
      if (metadataState.licenseSlug !== data.licenseSlug)
        unitPatch.license = metadataState.licenseSlug ?? null;
    }
    if (Object.keys(extensionPatch).length > 0)
      metadataPatch.extension = extensionPatch;
    if (Object.keys(unitPatch).length > 0) metadataPatch.unit = unitPatch;

    const translationPatch = {
      translations: {
        [editor.selectedLanguage]: {
          title: draft.title || null,
          subtitle: draft.subtitle || null,
          summary: draft.summary || null,
          description: draft.description
            ? markdownContentDoc(draft.description)
            : null,
        },
      },
    };

    if (Object.keys(metadataPatch).length > 0) {
      await updateBookMutation.mutateAsync({
        unitId: bookId,
        input: applyRestoreSource({ patch: metadataPatch }),
      });
    }

    await upsertTranslationMutation.mutateAsync({
      unitId: bookId,
      language: editor.selectedLanguage,
      input: applyRestoreSource({ patch: translationPatch }),
    });
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
        page_book_edit_info_translation_delete_confirm({
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
        {common_loading()}
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
        {common_no_data()}
      </div>
    );

  const resolvedPageTitle = pageTitle ?? page_book_edit_info_title();
  const sourceReleaseUnitId = editor.currentTranslation?.sourceReleaseUnitId;
  const hasAvailable = ALL_LANGUAGES.length > editor.existingLanguages.length;
  const locks = fieldLocksQuery.data?.locks;
  const selectedTranslationLockPaths = [
    `translations.${editor.selectedLanguage}.title`,
    `translations.${editor.selectedLanguage}.subtitle`,
    `translations.${editor.selectedLanguage}.summary`,
    `translations.${editor.selectedLanguage}.description`,
  ];
  const metadataLockPaths = [
    "extension.isbn13",
    "extension.coverUrl",
    "extension.pageCount",
    "extension.textLength",
    "extension.formatKey",
    "extension.isLicensed",
    "extension.extra",
    "unit.rating",
    "unit.license",
  ];

  return (
    <div className="mt-16 mx-auto max-w-3xl px-4 pb-16">
      {isRestoreMode ? (
        <div className="mb-8 space-y-3">
          <Alert>
            <AlertDescription>
              {history_restore_edit_notice({ sequence: restoreSequence })}
            </AlertDescription>
          </Alert>
          {restoreQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {history_restore_edit_load_failed()}
              </AlertDescription>
            </Alert>
          ) : null}
          {restoreQuery.isSuccess && !restoreContentPayload ? (
            <Alert variant="destructive">
              <AlertDescription>
                {history_restore_edit_content_missing()}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
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
              {common_back()}
            </Button>
          )}
          <Button
            disabled={restoreSubmitDisabled}
            onClick={() => handleSubmit()}
          >
            {common_submit()}
          </Button>
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
              {page_book_edit_info_translation_section_title()}
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

              <LockedFieldNotice
                locks={locks}
                paths={selectedTranslationLockPaths}
              />

              {!editor.currentTranslation && (
                <Alert>
                  <AlertDescription>
                    {page_book_edit_info_translation_empty_for_lang({
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
                        disabled={batchAuthorMutation.isPending}
                        onClick={() => setAuthorPickerOpen(true)}
                      >
                        <Plus className="size-4" />
                        {book_actions_add_author()}
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
                    {page_book_edit_info_translation_diverge_warning()}
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
                      {page_book_edit_info_translation_delete_button()}
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
              {page_book_edit_info_translation_section_title()}
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
            {book_edit_sections_metadata()}
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
          <div className="mt-6">
            <LockedFieldNotice locks={locks} paths={metadataLockPaths} />
          </div>
        </section>

        <section>
          <button
            type="button"
            className="flex items-center justify-between w-full group"
            onClick={() => setExtraOpen((o) => !o)}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {book_edit_sections_extra()}
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
            const existingAuthors =
              authorCreditsQuery.data?.filter(
                (credit) =>
                  credit.role === "author" && credit.entityId !== entityId,
              ) ?? [];
            batchAuthorMutation.mutate({
              unitId: bookId,
              request: {
                ops: [
                  {
                    op: "setCredits",
                    role: "author",
                    entries: [
                      ...existingAuthors.map((credit, index) => ({
                        entityId: credit.entityId,
                        sortOrder: index,
                      })),
                      {
                        entityId,
                        sortOrder: existingAuthors.length,
                      },
                    ],
                  },
                ],
              },
            });
          }}
        />
      ) : null}

      <UpdateBookDialog
        open={updateBookErrorOpen}
        onClose={() => setUpdateBookErrorOpen(false)}
        state={dialogState}
      />
    </div>
  );
};
