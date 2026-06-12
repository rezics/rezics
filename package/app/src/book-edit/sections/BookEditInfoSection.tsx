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
  AiDisclosureMode,
  ContentRating,
  CreateBookInput,
  CreationMode,
  EditorialPatchSubmission,
  LicenseSlug,
  UnitFieldLockDTO,
} from "@rezics/contract";
import {
  CreationMode as CreationModeValue,
  lockPathIntersectsPatchPath,
  mainMarkdownSource,
  markdownContentDoc,
  normalizeLanguage,
  UNIT_FIELD_LOCK_ALL,
} from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { ConfirmDialog } from "@rezics/ui";
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
import { QueryErrorDisplay } from "@/core";
import { EntityPicker } from "@/entity-picker";
import { useAuthoringLanguageDefault } from "@/shared/hooks/useAuthoringLanguageDefault";
import { TextLink } from "@/shared/ui/link";
import { resolvePublicationLicenseDefault } from "@/shared/utils/publication-license";
import { editorialPathLabel } from "@/unit";
import { AddTranslationDialog } from "../components/AddTranslationDialog";
import { BookExtraEditor } from "../components/Metadata/BookExtraEditor";
import {
  BookMetadataEditor,
  type BookMetadataValue,
} from "../components/Metadata/BookMetadataEditor";
import { SetSourceUnitControl } from "../components/SetSourceUnitControl";
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
  return getI18nRuntime().i18n.t("editor:authority_edit_form_locked_error", {
    paths,
  });
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
            ? getI18nRuntime().i18n.t(
                "editor:authority_edit_form_all_locked_notice",
              )
            : getI18nRuntime().i18n.t(
                "editor:authority_edit_form_locked_notice",
                {
                  fields: matched
                    .map((lock) => editorialPathLabel(lock.path))
                    .join(", "),
                },
              )}
        </span>
        <span className="mt-1 block text-xs leading-dense text-text-secondary">
          {getI18nRuntime().i18n.t(
            "editor:authority_edit_form_privileged_notice",
          )}
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
                  {getI18nRuntime().i18n.t(
                    "page:book_edit_info_dialog_view_book",
                  )}
                </TextLink>
              )}
            </p>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button onClick={onClose}>
            {getI18nRuntime().i18n.t("common:close")}
          </Button>
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
 * BookEditMainPage — 多语言图书编辑器。
 *
 * Layout: book-level metadata (isbn/cover/etc.) is edited once and saved via
 * `updateBook`. Per-language fields (title/subtitle/summary/description) live
 * in `translations[]` and are saved via `upsertTranslation` keyed by the
 * language picked in the language bar.
 * 布局：图书级元数据（isbn/cover 等）只编辑一次，通过 `updateBook` 保存。
 * 每种语言的字段（title/subtitle/summary/description）存放于 `translations[]`，
 * 通过 `upsertTranslation` 以语言栏中选中的语言为键保存。
 *
 * Mobile <640px:
 * +----------------------+
 * | Header (flex col)    |
 * | - Title (text-2xl)   |
 * | - Back | Submit btn  |
 * +----------------------+
 * | Creation Path        |
 * | (newBook only)       |
 * | - Options (full w)   |
 * +----------------------+
 * | Translation Section  |
 * | - Language bar       |
 * | - Fields (1 col)     |
 * | - Sync actions       |
 * +----------------------+
 * | Metadata Section     |
 * | - Editors (stacked)  |
 * +----------------------+
 * | Extra (collapsed)    |
 * +----------------------+
 *
 * Tablet 640-1023px:
 * +-----------------------+
 * | Header flex-between   |
 * | - Title | Buttons     |
 * +-----------------------+
 * | Creation Path         |
 * | - Options (2 col)     |
 * +-----------------------+
 * | Translations          |
 * | - Language bar        |
 * | - Fields grid         |
 * +-----------------------+
 * | Metadata              |
 * | - Multi-field layout  |
 * +-----------------------+
 *
 * Desktop 1024-1535px:
 * +---------------------+
 * | mx-auto max-w-3xl   |
 * | mt-16 pb-16         |
 * +---------------------+
 * | Header flex between |
 * | - Title | Buttons   |
 * +---------------------+
 * | space-y-16 sections |
 * | - Creation (2 col)  |
 * | - Languages flex-col|
 * | - Metadata editor   |
 * | - Extra toggle      |
 * +---------------------+
 *
 * Ultra-wide >=1536px:
 * +---------------------+
 * | max-w-3xl centered  |
 * | Same responsive     |
 * | layout as 1024px    |
 * +---------------------+
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
  const [deleteTranslationConfirmOpen, setDeleteTranslationConfirmOpen] =
    React.useState(false);
  const [authorPickerOpen, setAuthorPickerOpen] = React.useState(false);
  const [creationMode, setCreationMode] = React.useState<CreationMode>(
    CreationModeValue.WIKI,
  );

  const authoringLanguage = useAuthoringLanguageDefault();
  const editor = useBookTranslationEditor(data, authoringLanguage);

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
      aiDisclosureMode:
        (nullableString(
          unitPatch.aiDisclosureMode ?? bookExtension.aiDisclosureMode,
        ) as AiDisclosureMode | undefined) ?? data.aiDisclosureMode,
      aiDisclosureDetails:
        asRecordOrNull(
          unitPatch.aiDisclosureDetails ?? bookExtension.aiDisclosureDetails,
        ) ?? data.aiDisclosureDetails,
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
        title: getI18nRuntime().i18n.t(
          "page:book_edit_info_toast_create_success_title",
        ),
        message: getI18nRuntime().i18n.t(
          "page:book_edit_info_toast_create_success_message",
        ),
        showBookLink: true,
        bookId: responseData.unitId,
      });
      setUpdateBookErrorOpen(true);
    },
    onError: (err) => {
      setDialogState({
        title: getI18nRuntime().i18n.t(
          "page:book_edit_info_toast_create_failed_title",
        ),
        message: String(err || getI18nRuntime().i18n.t("common:unknown_error")),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const updateBookMutation = useUpdateBookMutation({
    onSuccess: () => {
      setDialogState({
        title: getI18nRuntime().i18n.t(
          "page:book_edit_info_toast_update_success_title",
        ),
        message: getI18nRuntime().i18n.t(
          "page:book_edit_info_toast_update_success_message",
        ),
      });
      setUpdateBookErrorOpen(true);
    },
    onError: (err) => {
      setDialogState({
        title: getI18nRuntime().i18n.t(
          "page:book_edit_info_toast_update_failed_title",
        ),
        message:
          lockedFieldMessage(err) ??
          String(err || getI18nRuntime().i18n.t("common:unknown_error")),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const upsertTranslationMutation = useUpsertTranslationMutation({
    affectedDetailKeys: () => (bookId ? [bookKeys.detail(bookId)] : []),
    onError: (err) => {
      setDialogState({
        title: getI18nRuntime().i18n.t(
          "page:book_edit_info_toast_update_failed_title",
        ),
        message:
          lockedFieldMessage(err) ??
          String(err || getI18nRuntime().i18n.t("common:unknown_error")),
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
      const createLanguage =
        normalizeLanguage(editor.selectedLanguage) ?? authoringLanguage;
      const createBookData: CreateBookInput = {
        isbn13: metadataState?.isbn13 ?? undefined,
        coverUrl: metadataState?.coverUrl ?? undefined,
        pageCount: metadataState?.pageCount ?? undefined,
        textLength: metadataState?.textLength,
        formatKey: metadataState?.formatKey ?? undefined,
        rating: metadataState?.rating,
        aiDisclosureMode: metadataState?.aiDisclosureMode,
        aiDisclosureDetails: metadataState?.aiDisclosureDetails,
        isLicensed: metadataState?.isLicensed,
        licenseSlug: resolvePublicationLicenseDefault({
          explicitSelection: metadataState?.licenseSlug,
        }),
        extra: metadataState?.extra,
        defaultLanguage: createLanguage,
        creationMode,
        translations: [
          {
            language: createLanguage,
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
          title: getI18nRuntime().i18n.t(
            "page:book_edit_info_toast_create_failed_title",
          ),
          message: getI18nRuntime().i18n.t(
            "page:book_edit_info_validation_publish_url_required",
          ),
          error: true,
        });
        setUpdateBookErrorOpen(true);
      }
      return;
    }

    if (restoreSubmitDisabled) {
      setDialogState({
        title: getI18nRuntime().i18n.t(
          "search:history_restore_edit_unavailable_title",
        ),
        message: getI18nRuntime().i18n.t(
          "search:history_restore_edit_unavailable_description",
        ),
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
      if (metadataState.aiDisclosureMode !== data.aiDisclosureMode)
        unitPatch.aiDisclosureMode = metadataState.aiDisclosureMode;
      if (
        !sameJson(metadataState.aiDisclosureDetails, data.aiDisclosureDetails)
      )
        unitPatch.aiDisclosureDetails =
          metadataState.aiDisclosureDetails ?? null;
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

    try {
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
    } catch {
      // Each mutation has its own onError that shows UI feedback; catch only prevents unhandled rejection.
      // 各 mutation 已有各自 onError 显示 UI 反馈；此处仅捕获以防止未处理的 rejection。
    }
  }

  function handleAddTranslation(params: {
    language: string;
    sourceUnitId: string | null;
  }) {
    if (!bookId) return;
    upsertTranslationMutation.mutate(
      {
        unitId: bookId,
        language: params.language,
        input: {
          sourceUnitId: params.sourceUnitId ?? undefined,
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
    setDeleteTranslationConfirmOpen(true);
  }

  function confirmDeleteCurrentTranslation() {
    if (!bookId) return;
    setDeleteTranslationConfirmOpen(false);
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
      <div className="w-full mt-16 mx-auto max-w-3xl px-4 text-muted-foreground">
        {getI18nRuntime().i18n.t("common:loading")}
      </div>
    );
  if (error)
    return (
      <div className="w-full mt-16 mx-auto max-w-3xl px-4">
        <QueryErrorDisplay error={error} />
      </div>
    );
  if (!data && !newBook)
    return (
      <div className="w-full mt-16 mx-auto max-w-3xl px-4 text-muted-foreground">
        {getI18nRuntime().i18n.t("common:no_data")}
      </div>
    );

  const resolvedPageTitle =
    pageTitle ?? getI18nRuntime().i18n.t("page:book_edit_info_title");
  const sourceUnitId = editor.currentTranslation?.sourceUnitId;
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
    "unit.aiDisclosureMode",
    "unit.aiDisclosureDetails",
    "unit.license",
  ];

  return (
    <div className="w-full mt-16 mx-auto max-w-3xl px-4 pb-16">
      {isRestoreMode ? (
        <div className="mb-8 space-y-3">
          <Alert>
            <AlertDescription>
              {getI18nRuntime().i18n.t("search:history_restore_edit_notice", {
                sequence: restoreSequence,
              })}
            </AlertDescription>
          </Alert>
          {restoreQuery.error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getI18nRuntime().i18n.t(
                  "search:history_restore_edit_load_failed",
                )}
              </AlertDescription>
            </Alert>
          ) : null}
          {restoreQuery.isSuccess && !restoreContentPayload ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getI18nRuntime().i18n.t(
                  "search:history_restore_edit_content_missing",
                )}
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
              {getI18nRuntime().i18n.t("common:back")}
            </Button>
          )}
          <Button
            disabled={
              restoreSubmitDisabled ||
              createBookMutation.isPending ||
              updateBookMutation.isPending ||
              upsertTranslationMutation.isPending ||
              deleteTranslationMutation.isPending
            }
            onClick={() => handleSubmit()}
          >
            {getI18nRuntime().i18n.t("common:submit")}
          </Button>
        </div>
      </div>

      <div className="space-y-16">
        {newBook && (
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {getI18nRuntime().i18n.t("book:creation_path_title")}
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
                  {getI18nRuntime().i18n.t("book:creation_path_catalog_entry")}
                </span>
                <span className="mt-1 block text-xs leading-dense opacity-80">
                  {getI18nRuntime().i18n.t(
                    "book:creation_path_catalog_entry_description",
                  )}
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
                  {getI18nRuntime().i18n.t("book:creation_path_personal_work")}
                </span>
                <span className="mt-1 block text-xs leading-dense opacity-80">
                  {getI18nRuntime().i18n.t(
                    "book:creation_path_personal_work_description",
                  )}
                </span>
              </button>
            </div>
          </section>
        )}

        {/* Translation: language bar + per-language fields + sync actions */}
        {/* 翻译：语言栏 + 每种语言的字段 + 同步操作 */}
        {!newBook && data && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {getI18nRuntime().i18n.t(
                "page:book_edit_info_translation_section_title",
              )}
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
                    {getI18nRuntime().i18n.t(
                      "page:book_edit_info_translation_empty_for_lang",
                      {
                        lang: editor.selectedLanguage,
                      },
                    )}
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
                        {getI18nRuntime().i18n.t("book:actions_add_author")}
                      </Button>
                    </div>
                  ) : null
                }
              />

              <SetSourceUnitControl
                book={data}
                language={editor.selectedLanguage}
                currentSourceUnitId={sourceUnitId}
              />

              {editor.isDirty && sourceUnitId && (
                <Alert>
                  <AlertDescription>
                    {getI18nRuntime().i18n.t(
                      "page:book_edit_info_translation_diverge_warning",
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <TranslationSyncActions
                sourceUnitId={sourceUnitId}
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
                      {getI18nRuntime().i18n.t(
                        "page:book_edit_info_translation_delete_button",
                      )}
                    </Button>
                  </div>
                )}
            </div>
          </section>
        )}

        {/* For newBook flow: just show one language's fields, no language bar yet */}
        {/* newBook 流程：仅显示单一语言的字段，暂不显示语言栏 */}
        {newBook && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {getI18nRuntime().i18n.t(
                "page:book_edit_info_translation_section_title",
              )}
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
            {getI18nRuntime().i18n.t("book:edit_sections_metadata")}
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
              {getI18nRuntime().i18n.t("book:edit_sections_extra")}
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

      <ConfirmDialog
        open={deleteTranslationConfirmOpen}
        onConfirm={confirmDeleteCurrentTranslation}
        onCancel={() => setDeleteTranslationConfirmOpen(false)}
        title={getI18nRuntime().i18n.t(
          "page:book_edit_info_translation_delete_confirm",
          { lang: editor.selectedLanguage },
        )}
        confirmLabel={getI18nRuntime().i18n.t("common:delete")}
        cancelLabel={getI18nRuntime().i18n.t("common:cancel")}
        variant="destructive"
        isPending={deleteTranslationMutation.isPending}
      />
    </div>
  );
};
