import {useQuery} from '@tanstack/react-query';
import type {CreateBookInput, BookDTO} from '@package/contract';
import {bookQueries} from '@package/api/book/book';
import {AccentBarWithTextShow} from '@/component/Common/Navigation/AccentBar';
import {BookMetadataEditor} from '@/component/Book/Metadata/BookMetadataEditor';
import React from 'react';
import {useTranslation} from 'react-i18next';
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
import EasyEditor from '@component/Form/EasyEditor.tsx';
import {
  useCreateBookMutation,
  useUpdateBookMutation,
} from '@package/api/book/book';
import {type UpdateBookInput} from '@package/contract';
import {useEffect} from 'react';
import {BookExtraEditor} from '@/component/Book/Metadata/BookExtraEditor';
import {RouterLink} from '@package/ui/Navigation/RouterLink.tsx';

function validatePublishURL(publishURL: string[]) {
  return publishURL.every(url => url.startsWith('https://'));
}

type BookMetadataValue = Partial<BookDTO>;

const updateBookDialog = (
  t: any,
  open: boolean,
  onClose: () => void,
  text: any | null,
) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{text?.title}</DialogTitle>
      <DialogContent>
        <Alert severity={text?.error ? 'error' : 'success'}>
          {' '}
          <Typography variant="body1">{text?.message}</Typography>
          <Typography variant="body1">
            {text?.showBookLink && (
              <RouterLink
                to="/book/$bookId"
                params={{bookId: text.bookId as string}}
              >
                {t('page.book_edit.info.dialog.view_book')}
              </RouterLink>
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

export interface BookEditInfoShowProps {
  bookId?: string;
  handleSubmit: () => void;
  setMetadataState: React.Dispatch<React.SetStateAction<BookMetadataValue>>;
  metadataState: BookMetadataValue;
  updateBookErrorOpen: boolean;
  setUpdateBookErrorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  updateBookErrorText: any | null;
  setUpdateBookErrorText: React.Dispatch<React.SetStateAction<any | null>>;
}

export interface BookEditMainPageProps {
  newBook?: boolean;
  pageTitle?: string;
}

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
  const [updateBookErrorText, setUpdateBookErrorText] = React.useState<
    any | null
  >(null);
  useEffect(() => {
    setMetadataState(data ?? {});
  }, [data]);

  const createBookMutation = useCreateBookMutation({
    onSuccess: data => {
      console.log('create book success', data);
      setUpdateBookErrorText({
        title: t('page.book_edit.info.toast.create_success_title'),
        message: t('page.book_edit.info.toast.create_success_message'),
        showBookLink: true,
        bookId: data.unitId,
      });
      setUpdateBookErrorOpen(true);
    },
    onError: error => {
      console.error('create book failed', error);
      setUpdateBookErrorText({
        title: t('page.book_edit.info.toast.create_failed_title'),
        message: String(error || t('common.unknown_error')),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });

  const updateBookMutation = useUpdateBookMutation({
    onSuccess: data => {
      console.log('update book success', data);
      setUpdateBookErrorText({
        title: t('page.book_edit.info.toast.update_success_title'),
        message: t('page.book_edit.info.toast.update_success_message'),
      });
      setUpdateBookErrorOpen(true);
    },
    onError: error => {
      console.error('update book failed', error);
      setUpdateBookErrorText({
        title: t('page.book_edit.info.toast.update_failed_title'),
        message: String(error || t('common.unknown_error')),
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
        setUpdateBookErrorText({
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
      {/* ANCHOR Book Metadata */}
      <div>
        <div className="flex mb-4">
          <AccentBarWithTextShow text={t('book.edit_sections.metadata')} />
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
      {/* ANCHOR Book Description */}
      <div>
        <div className="flex mb-4">
          <AccentBarWithTextShow text={t('book.description')} />
        </div>
        <EasyEditor
          value={metadataState?.description ?? ''}
          onChange={value => {
            setMetadataState(prev => ({...prev, description: value}));
          }}
        />
      </div>
      {/* ANCHOR Book Extra */}
      <div>
        <div className="flex mb-4">
          <AccentBarWithTextShow text={t('book.edit_sections.extra')} />
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
      {updateBookDialog(
        t,
        updateBookErrorOpen,
        () => {
          setUpdateBookErrorOpen(false);
        },
        updateBookErrorText,
      )}
    </div>
  );
};
