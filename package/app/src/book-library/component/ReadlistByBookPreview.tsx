import {ReadlistList} from '@/readlist/component/ReadlistList.tsx';
import {AccentBarWithText} from '@package/ui/composite/typography/AccentBarWithText.tsx';
import {ArrowForwardIcon} from '@package/ui/composite/navigation/ArrowForwardIcon.tsx';

import {useQuery} from '@tanstack/react-query';
import {buildMeiliReadlistQuery} from '@package/api/meili/meili.queries';
import {useTranslation} from 'react-i18next';

export function ReadlistByBookPreview({
  title,
  bookId,
  readlistNumber = 6,
}: {
  title: string;
  bookId?: string;
  readlistNumber?: number;
}) {
  const {t} = useTranslation();
  const {data, isLoading, error} = useQuery(
    buildMeiliReadlistQuery(0, readlistNumber, '', [], {bookId}),
  );

  if (isLoading) {
    return <div>{t('common.loading')}</div>;
  }
  if (error && error instanceof Error)
    return (
      <div>
        {t('common.error')}: {error.message}
      </div>
    );

  return (
    <div>
      <ArrowForwardIcon size={16} to={`/readlist/book/${bookId}`}>
        <AccentBarWithText text={t('readlist.includes_book_title', {title})} />
      </ArrowForwardIcon>
      <div className="mb-4" />
      <ReadlistList
        booklists={data?.readlists?.slice(0, readlistNumber) || []}
      />
    </div>
  );
}
