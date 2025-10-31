import {readlistQueries} from '@/api/readlist/readlist';
import {AccentBarWithTextShow} from '@/component/Common/AccentBar.tsx';
import {ReadlistList} from '@/component/ReadList/ReadlistList.tsx';
import {useTranslation} from 'react-i18next';
import {useQuery} from '@tanstack/react-query';

export function ReadlistByBookPage() {
  const {t} = useTranslation();
  // TODO: 从路由或父组件获取实际 bookId
  const bookId = '0';

  const {data, isLoading, error} = useQuery(
    readlistQueries.list({hasBookUnitId: bookId, limit: 20}),
  );

  const booklists = data?.readlists ?? [];

  if (isLoading) {
    return <div className="w-11/12 mx-auto mt-10">Loading...</div>;
  }
  if (error && error instanceof Error) {
    return (
      <div className="w-11/12 mx-auto mt-10 text-red-500">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithTextShow text={`${t('pages.book_collection_list_page')}`} />
      <div className="mt-4">
        <ReadlistList booklists={booklists} />
      </div>
    </div>
  );
}
