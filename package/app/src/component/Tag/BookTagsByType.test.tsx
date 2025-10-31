import {useFixtureInput} from 'react-cosmos/client';
import {useEffect, useMemo} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {createQueryClient} from '@/api/react-query/tsr';
import {tagQueries} from '@/api/tag';
import type {TagDTO} from '@package/contract';
import {BookTagsByType} from './BookTagsExample';

function seedListForType(
  qc: any,
  bookUnitId: string,
  tagType: string,
  tags: TagDTO[],
) {
  const key = tagQueries.list({
    objectId: bookUnitId,
    type: tagType,
    limit: 100,
  }).queryKey;
  qc.setQueryData(key, {tags, total: tags.length});
}

export default function Fixture() {
  const qc = useMemo(() => createQueryClient(), []);

  const [controls] = useFixtureInput('Controls', {
    bookUnitId: 'book-1',
    tagType: 'genre',
    label: 'Genres',
    scenario: 'with-data' as 'with-data' | 'empty',
  });

  useEffect(() => {
    if (controls.scenario === 'with-data') {
      const tags =
        controls.tagType === 'author'
          ? ([{id: 'a1', name: 'Author A', type: 'author'}] as TagDTO[])
          : ([{id: 'g1', name: 'Fantasy', type: 'genre'}] as TagDTO[]);
      seedListForType(qc, controls.bookUnitId, controls.tagType, tags);
    } else {
      seedListForType(qc, controls.bookUnitId, controls.tagType, []);
    }
  }, [controls, qc]);

  return (
    <QueryClientProvider client={qc}>
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">BookTagsByType</h3>
        <BookTagsByType
          bookUnitId={controls.bookUnitId}
          tagType={controls.tagType}
          label={controls.label}
        />
      </div>
    </QueryClientProvider>
  );
}
