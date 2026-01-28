import { ReadlistList } from '@component/ReadList/ReadlistList.tsx';
import { AccentBarWithTextContainer } from '../Common/Navigation/AccentBar.tsx';
import { ArrowForwardIconContainer } from '../Common/Navigation/ArrowForwardIcon.tsx';

import { useQuery } from '@tanstack/react-query';
import { buildMeiliReadlistQuery } from '@package/api/meili/meili.queries';
import { useTranslation } from 'react-i18next';

export function ReadlistByBookPreview({
  title,
  bookId,
  readlistNumber = 6,
}: {
  title: string;
  bookId?: string;
  readlistNumber?: number;
}) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery(
    buildMeiliReadlistQuery(0, readlistNumber, '', [], { bookId }),
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
      <ArrowForwardIconContainer size={16} to={`/readlist/book/${bookId}`}>
        <AccentBarWithTextContainer
          text={t('readlist.includes_book_title', { title })}
        />
      </ArrowForwardIconContainer>
      <div className="mb-4" />
      <ReadlistList
        booklists={data?.readlists?.slice(0, readlistNumber) || []}
      />
    </div>
  );
}
