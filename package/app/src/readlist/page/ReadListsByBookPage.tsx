import {AccentBarWithText} from '@rezics/ui/composite/typography/AccentBarWithText.tsx';
import {ReadListsPage} from './ReadListsPage.tsx';
import {useTranslation} from 'react-i18next';
import {readlistByBookRoute} from '@/router';

export function ReadlistByBookPage() {
  const {bookId} = readlistByBookRoute.useParams();
  const {t} = useTranslation();

  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithText text={`${t('pages.book_collection_list_page')}`} />
      <div className="mt-4">
        <ReadListsPage bookUnitId={bookId} />
      </div>
    </div>
  );
}
