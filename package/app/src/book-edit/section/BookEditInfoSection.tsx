import { ExpandMore } from "@mui/icons-material";
import {
  Alert,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from "@mui/material";
import {
  bookQueries,
  useCreateBookMutation,
  useUpdateBookMutation,
} from "@rezics/api/book/book";
import type {
  BookDTO,
  CreateBookInput,
  UpdateBookInput,
} from "@rezics/contract";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";
import { getBookDescription, getBookTitle } from "@/shared/util/translation-helpers";
import { BookExtraEditor } from "../component/Metadata/BookExtraEditor";
import { BookMetadataEditor, type BookMetadataValue } from "../component/Metadata/BookMetadataEditor";

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
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{state?.title}</DialogTitle>
      <DialogContent>
        <Alert severity={state?.error ? "error" : "success"}>
          <Typography variant="body1">{state?.message}</Typography>
          <Typography variant="body1">
            {state?.showBookLink && state?.bookId && (
              <MUILink to="/book/$bookId" params={{ bookId: state.bookId }}>
                {t("page.book_edit.info.dialog.view_book")}
              </MUILink>
            )}
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export interface BookEditMainPageProps {
  newBook?: boolean;
  pageTitle?: string;
}

/**
 * BookEditMainPage - updated for new BookDTO with translations layer.
 * Title/description are now in translations[], not top-level fields.
 * isbn -> isbn13, coverUrl -> coverAssetUnitId, author/press/producer -> personCredits/orgCredits.
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
  const [descriptionOverride, setDescriptionOverride] =
    React.useState<string | null>(null);
  const [updateBookErrorOpen, setUpdateBookErrorOpen] = React.useState(false);
  const [dialogState, setDialogState] =
    React.useState<UpdateBookDialogState>(null);
  const [extraOpen, setExtraOpen] = React.useState(true);

  const metadata: BookMetadataValue = metadataState ?? data ?? {};
  const currentDescription = descriptionOverride ?? getBookDescription(data);

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

  async function handleSubmit() {
    const editTitle = metadataState?._editTitle ?? getBookTitle(data);
    const editDescription = descriptionOverride ?? getBookDescription(data);

    const updateBookData: UpdateBookInput = {
      isbn13: metadataState?.isbn13,
      coverAssetUnitId: metadataState?.coverAssetUnitId,
      pageCount: metadataState?.pageCount,
      textLength: metadataState?.textLength,
      formatKey: metadataState?.formatKey,
      nsfw: metadataState?.nsfw,
      isLicensed: metadataState?.isLicensed,
      extra: metadataState?.extra,
    };

    const createBookData: CreateBookInput = {
      ...updateBookData,
      defaultLanguage: 'zh-CN',
      translations: [
        {
          language: 'zh-CN',
          title: editTitle,
          description: editDescription,
        },
      ],
    };

    if (bookId) {
      updateBookMutation.mutateAsync({
        unitId: bookId,
        input: updateBookData,
      });
    } else {
      const publishURL = metadataState?.extra?.publishURL;
      if (
        updateBookData.isLicensed ||
        (publishURL && validatePublishURL(publishURL))
      ) {
        createBookMutation.mutateAsync(createBookData);
      } else {
        setDialogState({
          title: t("page.book_edit.info.toast.create_failed_title"),
          message: t("page.book_edit.info.validation.publish_url_required"),
          error: true,
        });
        setUpdateBookErrorOpen(true);
      }
    }
  }

  if (isLoading) return <div className="mt-10 mx-auto max-w-3xl px-4 text-muted-foreground">{t("common.loading")}</div>;
  if (error)
    return (
      <div className="mt-10 mx-auto max-w-3xl px-4 text-destructive">
        {t("common.error")}: {String(error)}
      </div>
    );
  if (!data && !newBook) return <div className="mt-10 mx-auto max-w-3xl px-4 text-muted-foreground">{t("common.no_data")}</div>;

  const resolvedPageTitle = pageTitle ?? t("page.book_edit.info.title");

  return (
    <div className="mt-10 mx-auto max-w-3xl px-4 pb-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">{resolvedPageTitle}</h1>
        <div className="flex items-center gap-2">
          {bookId && (
            <Button
              variant="outlined"
              onClick={() => navigate({ to: `/book/${bookId}/` })}
            >
              {t("common.back")}
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => handleSubmit()}
          >
            {t("common.submit")}
          </Button>
        </div>
      </div>

      <div className="space-y-10">
        {/* Metadata */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("book.edit_sections.metadata")}
          </h3>
          <Divider className="mb-5" />
          <BookMetadataEditor
            value={metadata}
            onChange={(value) => {
              setMetadataState((prev) => ({ ...(prev ?? data ?? {}), ...value }));
            }}
          />
        </section>

        {/* Description */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("book.description")}
          </h3>
          <Divider className="mb-5" />
          <RezicsMarkdownEditor
            value={currentDescription}
            onChange={(value) => {
              setDescriptionOverride(value);
            }}
          />
        </section>

        {/* Extra -- Collapsible */}
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
              sx={{
                fontSize: 20,
                color: "text.secondary",
                transition: "transform 200ms ease",
                transform: extraOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>
          <Divider className="mt-3 mb-5" />
          <Collapse in={extraOpen} timeout="auto" unmountOnExit>
            <BookExtraEditor
              value={metadata.extra}
              onChange={(value) => {
                setMetadataState((prev) => ({ ...prev, extra: value }));
              }}
            />
          </Collapse>
        </section>
      </div>

      <UpdateBookDialog
        t={t}
        open={updateBookErrorOpen}
        onClose={() => setUpdateBookErrorOpen(false)}
        state={dialogState}
      />
    </div>
  );
};
