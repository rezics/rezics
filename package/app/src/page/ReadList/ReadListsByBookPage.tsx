import {AccentBarWithTextShow} from '@/component/Common/Navigation/AccentBar.tsx';
import {ReadListsPage} from './ReadListsPage.tsx';
import {useTranslation} from 'react-i18next';
import {readlistByBookRoute} from '@/router/router';

export function ReadlistByBookPage() {
  const {bookId} = readlistByBookRoute.useParams();
  const {t} = useTranslation();

  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithTextShow text={`${t('pages.book_collection_list_page')}`} />
      <div className="mt-4">
        <ReadListsPage bookUnitId={bookId} />
      </div>
    </div>
  );
}
