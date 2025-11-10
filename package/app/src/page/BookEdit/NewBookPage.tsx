import type {BookDTO} from '@package/contract';
import {BookEditInfoShow} from './InfoPage';
import {NewBookByUrl} from '@/component/Book/Metadata/NewBookByUrl';
import React from 'react';
import {useCreateBookMutation} from '@/api/book/book';
import {useUserStore, type PartialUserDTO} from '@/global/userStore';

type BookMetadataValue = Partial<BookDTO>;

export function NewBookPage() {
  const user: PartialUserDTO | null = useUserStore(state => state.user);
  const [metadataState, setMetadataState] = React.useState<BookMetadataValue>(
    {},
  );
  const [updateBookErrorOpen, setUpdateBookErrorOpen] = React.useState(false);
  const [updateBookErrorText, setUpdateBookErrorText] = React.useState<
    any | null
  >(null);
  const createBookMutation = useCreateBookMutation({
    onSuccess: data => {
      console.log('create book success', data);
      setUpdateBookErrorText({
        title: '创建书籍成功',
        message:
          '创建书籍成功，书籍详情页可能需要等待几分钟/手动刷新才能看到最新内容。',
      });
      setUpdateBookErrorOpen(true);
    },
    onError: error => {
      console.error('create book failed', error);
      setUpdateBookErrorText({
        title: '创建书籍失败',
        message: String(error || 'Unknown error'),
        error: true,
      });
      setUpdateBookErrorOpen(true);
    },
  });
  function handleSubmit() {
    createBookMutation.mutate({
      title: metadataState.title ?? '',
      description: metadataState.description ?? '',
      authorIds: metadataState.author?.map(author => author.unitId) ?? [],
      pressIds: metadataState.press?.map(press => press.unitId) ?? [],
      producerIds:
        metadataState.producer?.map(producer => producer.unitId) ?? [],
      isbn: metadataState.isbn ?? '',
      coverUrl: metadataState.coverUrl ?? '',
    });
  }
  return (
    <div>
      {user?.permission?.role?.includes('ADMIN') ? (
        <BookEditInfoShow
          handleSubmit={handleSubmit}
          setMetadataState={setMetadataState}
          metadataState={metadataState}
          updateBookErrorOpen={updateBookErrorOpen}
          setUpdateBookErrorOpen={setUpdateBookErrorOpen}
          updateBookErrorText={updateBookErrorText}
          setUpdateBookErrorText={setUpdateBookErrorText}
        />
      ) : (
        <NewBookByUrl />
      )}
    </div>
  );
}
