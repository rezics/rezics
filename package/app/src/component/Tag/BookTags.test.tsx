import {useFixtureInput} from 'react-cosmos/client';
import {useEffect, useMemo} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {createQueryClient} from '@/api/react-query/tsr';
import {tagQueries} from '@/api/tag';
import type {TagDTO} from '@package/contract';
import {BookTags} from './BookTagsExample';

function seedList(qc: any, bookUnitId: string, tags: TagDTO[]) {
  const key = tagQueries.list({objectId: bookUnitId, limit: 100}).queryKey;
  qc.setQueryData(key, {tags, total: tags.length});
}

export default function Fixture() {
  const qc = useMemo(() => createQueryClient(), []);

  const [controls] = useFixtureInput('Controls', {
    state: 'with-data' as 'loading' | 'empty' | 'with-data',
    bookUnitId: 'book-1',
  });

  useEffect(() => {
    if (controls.state === 'with-data') {
      seedList(qc, controls.bookUnitId, [
        {id: 't1', name: 'Fantasy', type: 'genre'} as TagDTO,
        {id: 't2', name: 'Adventure', type: 'genre'} as TagDTO,
        {id: 't3', name: 'Classic', type: 'general'} as TagDTO,
      ]);
    } else if (controls.state === 'empty') {
      seedList(qc, controls.bookUnitId, []);
    } else {
      // loading: do not seed
    }
  }, [controls, qc]);

  return (
    <QueryClientProvider client={qc}>
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">BookTags</h3>
        <p className="text-sm text-gray-500">State: {controls.state}</p>
        <BookTags bookUnitId={controls.bookUnitId} />
      </div>
    </QueryClientProvider>
  );
}
