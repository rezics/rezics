import {useQuery} from '@tanstack/react-query';
import {type BookDTO} from '@package/contract';
import {bookQueries} from '@/api/book/book';
import {AccentBarWithTextShow} from '@/component/Common/AccentBar.tsx';
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
import {useLocation} from 'wouter';
import EasyEditor from '@component/Form/EasyEditor.tsx';
import {useUpdateBookMutation} from '@/api/book/book';
import {type UpdateBookInput} from '@package/contract';
import {useEffect} from 'react';
// import Paper from "@mui/material/Paper";

type BookMetadataValue = Partial<BookDTO>;

const updateBookDialog = (
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
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
};

interface BookEditInfoShowProps {
  bookId?: string;
  handleSubmit: () => void;
  setMetadataState: React.Dispatch<React.SetStateAction<BookMetadataValue>>;
  metadataState: BookMetadataValue;
  updateBookErrorOpen: boolean;
  setUpdateBookErrorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  updateBookErrorText: any | null;
  setUpdateBookErrorText: React.Dispatch<React.SetStateAction<any | null>>;
}

export const BookEditInfoShow: React.FC<BookEditInfoShowProps> = ({
  bookId,
  handleSubmit,
  setMetadataState,
  metadataState,
  updateBookErrorOpen,
  setUpdateBookErrorOpen,
  updateBookErrorText,
}) => {
  const {t} = useTranslation();
  const [_location, navigate] = useLocation();
  return (
    <div className="mt-10 mx-auto w-11/12">
      <div className="flex justify-between items-center">
        <div className="text-2xl font-bold mb-4">书籍编辑</div>
        <div className="flex items-center gap-2">
          {bookId ? (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => {
                navigate(`/book/${bookId}/`);
              }}
            >
              返回
            </Button>
          ) : null}
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleSubmit();
            }}
          >
            提交
          </Button>
        </div>
      </div>
      <div>
        <div className="flex mb-4">
          <AccentBarWithTextShow text="MetaData" />
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
          <AccentBarWithTextShow text={t('book.description')} />
        </div>
        <EasyEditor
          value={metadataState?.description ?? ''}
          onChange={value => {
            setMetadataState(prev => ({...prev, description: value}));
          }}
        />
      </div>
      {updateBookDialog(
        updateBookErrorOpen,
        () => {
          setUpdateBookErrorOpen(false);
        },
        updateBookErrorText,
      )}
    </div>
  );
};

interface BookEditMainPageProps {
  bookId: string;
}

export const BookEditMainPage: React.FC<BookEditMainPageProps> = ({bookId}) => {
  const {data, isLoading, error} = useQuery(bookQueries.detail(bookId));
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

  const updateBookMutation = useUpdateBookMutation({
    onSuccess: data => {
      console.log('update book success', data);
      setUpdateBookErrorText({
        title: '更新书籍成功',
        message:
          '更新书籍成功，书籍详情页可能需要等待几分钟/手动刷新才能看到最新内容。',
      });
      setUpdateBookErrorOpen(true);
    },
    onError: error => {
      console.error('update book failed', error);
      setUpdateBookErrorText({
        title: '更新书籍失败',
        message: String(error || 'Unknown error'),
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
    };
    updateBookMutation.mutateAsync({
      postId: bookId,
      input: updateBookData,
    });
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {String(error)}</div>;
  if (!data) return <div>No data</div>;
  return (
    <BookEditInfoShow
      bookId={bookId}
      handleSubmit={handleSubmit}
      setMetadataState={setMetadataState}
      metadataState={metadataState}
      updateBookErrorOpen={updateBookErrorOpen}
      setUpdateBookErrorOpen={setUpdateBookErrorOpen}
      updateBookErrorText={updateBookErrorText}
      setUpdateBookErrorText={setUpdateBookErrorText}
    />
  );
};
