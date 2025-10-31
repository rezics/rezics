import {ReadlistList} from '@component/ReadList/ReadlistList.tsx';
import {Link as _Link} from 'wouter';
import {AccentBarWithTextContainer} from '../Common/AccentBar.tsx';
import {ArrowForwardIconContainer} from '../Common/ArrowForwardIcon.tsx';

import {readlistQueries} from '@/api/readlist/readlist';
import {useQuery} from '@tanstack/react-query';

export function ReadlistByBookPreview({
  title,
  bookId,
}: {
  title: string;
  bookId?: string;
}) {
  // 获取包含该书的书单数据
  const {data, isLoading, error} = useQuery(
    readlistQueries.list({hasBookUnitId: bookId || '', limit: 4}),
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
      {/* 此处应该显示书单列表 */}
    </div>
  );
}
