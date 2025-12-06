import {ReadlistList} from '@component/ReadList/ReadlistList.tsx';
import {Link as _Link} from 'wouter';
import {AccentBarWithTextContainer} from '../Common/Navigation/AccentBar.tsx';
import {ArrowForwardIconContainer} from '../Common/Navigation/ArrowForwardIcon.tsx';

import {useQuery} from '@tanstack/react-query';
import {buildMeiliReadlistQuery} from '@/api/meili/meili.queries';

export function ReadlistByBookPreview({
  title,
  bookId,
  readlistNumber = 6,
}: {
  title: string;
  bookId?: string;
  readlistNumber?: number;
}) {
  const {data, isLoading, error} = useQuery(
    buildMeiliReadlistQuery(0, readlistNumber, '', [], {bookId}),
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (error && error instanceof Error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <ArrowForwardIconContainer size={16} to={`/readlist/book/${bookId}`}>
        <AccentBarWithTextContainer text={`包含 ${title} 的书单`} />
      </ArrowForwardIconContainer>
      <div className="mb-4" />
      <ReadlistList
        booklists={data?.readlists?.slice(0, readlistNumber) || []}
      />
    </div>
  );
}
