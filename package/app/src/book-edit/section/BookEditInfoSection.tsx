import {useQuery} from '@tanstack/react-query';
import type {CreateBookInput, BookDTO} from '@package/contract';
import {bookQueries} from '@package/api/book/book';
import {AccentBarWithText} from '@package/ui/composite/typography/AccentBarWithText.tsx';
import {BookMetadataEditor} from '../component/Metadata/BookMetadataEditor';
import React from 'react';
import {useTranslation} from 'react-i18next';
import type {TFunction} from 'i18next';
import {
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Typography,
  Alert,
} from '@mui/material';
import {useMatchRoute, useNavigate} from '@tanstack/react-router';
import EasyEditor from '@package/ui/editor/easyeditor/EasyEditor.tsx';
import {
  useCreateBookMutation,
  useUpdateBookMutation,
} from '@package/api/book/book';
import {type UpdateBookInput} from '@package/contract';
import {useEffect} from 'react';
import {BookExtraEditor} from '../component/Metadata/BookExtraEditor';
import {MUILink} from '@package/ui/primitive/link/MUILink.tsx';

function validatePublishURL(publishURL: string[]) {
  return publishURL.every(url => url.startsWith('https://'));
}

type BookMetadataValue = Partial<BookDTO>;

/** Dialog state for showing update/create results. */
type UpdateBookDialogState = {
  title: string;
  message: string;
  error?: boolean;
  showBookLink?: boolean;
  bookId?: string;
} | null;

/**
 * Renders a dialog showing the result of book update/create operation.
 */
const UpdateBookDialog: React.FC<{
  t: TFunction;
  open: boolean;
  onClose: () => void;
  state: UpdateBookDialogState;
}> = ({t, open, onClose, state}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{state?.title}</DialogTitle>
      <DialogContent>
        <Alert severity={state?.error ? 'error' : 'success'}>
          <Typography variant="body1">{state?.message}</Typography>
          <Typography variant="body1">
            {state?.showBookLink && state?.bookId && (
              <MUILink to="/book/$bookId" params={{bookId: state.bookId}}>
                {t('page.book_edit.info.dialog.view_book')}
              </MUILink>
            )}
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Props for BookEditMainPage component. */
export interface BookEditMainPageProps {
  /** Whether this is creating a new book. */
  newBook?: boolean;
  /** Custom page title. */
  pageTitle?: string;
}

/**
 * Book Edit Main Page - Form for editing or creating a book.
 */
export const BookEditMainPage: React.FC<BookEditMainPageProps> = ({
  newBook = false,
  pageTitle,
}) => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const editParams = matchRoute({to: '/book/$bookId/edit', fuzzy: false});
  const bookId = !newBook && editParams ? editParams.bookId : undefined;
  const {data, isLoading, error} = useQuery({
    ...bookQueries.detail(bookId ?? ''),
    enabled: !newBook && !!bookId,
  });
  const [metadataState, setMetadataState] = React.useState<BookMetadataValue>(
    {},
  );
  const [updateBookErrorOpen, setUpdateBookErrorOpen] = React.useState(false);
  const [dialogState, setDialogState] =
    React.useState<UpdateBookDialogState>(null);

  useEffect(() => {
    setMetadataState(data ?? {});
  }, [data]);

  const createBookMutation = useCreateBookMutation({
    onSuccess: responseData => {
      setDialogState({
        title: t('page.book_edit.info.toast.create_success_title'),
        message: t('page.book_edit.info.toast.create_success_message'),
        showBookLink: true,
        bookId: responseData.unitId,
      });
      setUpdateBookErrorOpen(true);
    },
    onError: err => {
      setDialogState({
        title: t('page.book_edit.info.toast.create_failed_title'),
        message: String(err || t('common.unknown_error')),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const updateBookMutation = useUpdateBookMutation({
    onSuccess: () => {
      setDialogState({
        title: t('page.book_edit.info.toast.update_success_title'),
        message: t('page.book_edit.info.toast.update_success_message'),
      });
      setUpdateBookErrorOpen(true);
    },
    onError: err => {
      setDialogState({
        title: t('page.book_edit.info.toast.update_failed_title'),
        message: String(err || t('common.unknown_error')),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  async function handleSubmit() {
    const updateBookData: UpdateBookInput = {
      title: metadataState.title,
      description: metadataState.description,
      authorIds: metadataState.author?.map(author => author.unitId),
      pressIds: metadataState.press?.map(press => press.unitId),
      producerIds: metadataState.producer?.map(producer => producer.unitId),
      textLength: metadataState.textLength,
      isbn: metadataState.isbn,
      coverUrl: metadataState.coverUrl,
      nsfw: metadataState.nsfw,
      isLicensed: metadataState.isLicensed,
      extra: metadataState.extra,
    };
    const createBookData: CreateBookInput = {
      ...updateBookData,
      title: metadataState.title ?? '',
    };
    if (bookId) {
      updateBookMutation.mutateAsync({
        postId: bookId,
        input: updateBookData,
      });
    } else {
      const publishURL = metadataState.extra?.publishURL;
      if (
        updateBookData.isLicensed ||
        (publishURL && validatePublishURL(publishURL))
      ) {
        createBookMutation.mutateAsync({
          ...createBookData,
        });
      } else {
        setDialogState({
          title: t('page.book_edit.info.toast.create_failed_title'),
          message: t('page.book_edit.info.validation.publish_url_required'),
          error: true,
        });
        setUpdateBookErrorOpen(true);
      }
    }
  }

  if (isLoading) return <div>{t('common.loading')}</div>;
  if (error)
    return (
      <div>
        {t('common.error')}: {String(error)}
      </div>
    );
  if (!data && !newBook) return <div>{t('common.no_data')}</div>;

  const resolvedPageTitle = pageTitle ?? t('page.book_edit.info.title');

  return (
    <div className="mt-10 mx-auto w-11/12">
      <div className="flex justify-between items-center">
        <div className="text-2xl font-bold mb-4">{resolvedPageTitle}</div>
        <div className="flex items-center gap-2">
          {bookId ? (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => {
                navigate({to: `/book/${bookId}/`});
              }}
            >
              {t('common.back')}
            </Button>
          ) : null}
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleSubmit();
            }}
          >
            {t('common.submit')}
          </Button>
        </div>
      </div>

      <div>
        <div className="flex mb-4">
          <AccentBarWithText text={t('book.edit_sections.metadata')} />
        </div>
        <div className="mb-8">
          <BookMetadataEditor
            value={metadataState}
            onChange={value => {
              setMetadataState(prev => ({...prev, ...value}));
            }}
          />
        </div>
      </div>

      <div>
        <div className="flex mb-4">
          <AccentBarWithText text={t('book.description')} />
        </div>
        <EasyEditor
          value={metadataState?.description ?? ''}
          onChange={value => {
            setMetadataState(prev => ({...prev, description: value}));
          }}
        />
      </div>

      <div>
        <div className="flex mb-4">
          <AccentBarWithText text={t('book.edit_sections.extra')} />
        </div>
        <div className="mb-8">
          <BookExtraEditor
            value={metadataState.extra}
            onChange={value => {
              setMetadataState(prev => ({...prev, extra: value}));
            }}
          />
        </div>
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
