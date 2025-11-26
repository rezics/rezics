import {ReadlistList} from '@component/ReadList/ReadlistList.tsx';
import {Link as _Link} from 'wouter';
import {AccentBarWithTextContainer} from '../Common/AccentBar.tsx';
import {ArrowForwardIconContainer} from '../Common/ArrowForwardIcon.tsx';

import {useQuery} from '@tanstack/react-query';
import {buildMeiliUnitQuery} from '@/api/meili/meili.queries';
import {mapUnitListToReadlistListResponse} from '@/api/meili/meili.api';
import {UnitType} from '@package/contract/src/unit';

export function ReadlistByBookPreview({
  title,
  bookId,
}: {
  title: string;
  bookId?: string;
}) {
  const targetUnitId = bookId || '';

  const {data, isLoading, error} = useQuery(
    buildMeiliUnitQuery(
      UnitType.READLIST,
      0,
      targetUnitId,
      '',
      4,
      mapUnitListToReadlistListResponse,
      {
        enabled: !!targetUnitId,
      },
    ),
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
      <ReadlistList booklists={data?.readlists || []} />
    </div>
  );
}
