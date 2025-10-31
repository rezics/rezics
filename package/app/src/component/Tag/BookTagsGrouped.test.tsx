import {useFixtureInput} from 'react-cosmos/client';
import {useEffect, useMemo} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {createQueryClient} from '@/api/react-query/tsr';
import {tagQueries} from '@/api/tag';
import type {TagDTO} from '@package/contract';
import {BookTagsGrouped} from './BookTagsExample';

function seedList(qc: any, bookUnitId: string, tags: TagDTO[]) {
  const key = tagQueries.list({objectId: bookUnitId, limit: 100}).queryKey;
  qc.setQueryData(key, {tags, total: tags.length});
}

export default function Fixture() {
  const qc = useMemo(() => createQueryClient(), []);

  const [controls] = useFixtureInput('Controls', {
    bookUnitId: 'book-1',
    scenario: 'mixed' as 'mixed' | 'only-general' | 'only-genre',
  });

  useEffect(() => {
    let tags: TagDTO[] = [];
    if (controls.scenario === 'mixed') {
      tags = [
        {id: 't1', name: 'Fantasy', type: 'genre'} as TagDTO,
        {id: 't2', name: 'Mystery', type: 'genre'} as TagDTO,
        {id: 't3', name: 'Bestseller', type: 'general'} as TagDTO,
        {id: 't4', name: 'Translated', type: 'general'} as TagDTO,
        {id: 't5', name: 'J. Doe', type: 'author'} as TagDTO,
      ];
    } else if (controls.scenario === 'only-general') {
      tags = [
        {id: 't3', name: 'Bestseller', type: 'general'} as TagDTO,
        {id: 't4', name: 'Translated', type: 'general'} as TagDTO,
      ];
    } else if (controls.scenario === 'only-genre') {
      tags = [
        {id: 't1', name: 'Fantasy', type: 'genre'} as TagDTO,
        {id: 't2', name: 'Mystery', type: 'genre'} as TagDTO,
      ];
    }
    seedList(qc, controls.bookUnitId, tags);
  }, [controls, qc]);

  return (
    <QueryClientProvider client={qc}>
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">BookTagsGrouped</h3>
        <BookTagsGrouped bookUnitId={controls.bookUnitId} />
      </div>
    </QueryClientProvider>
  );
}
