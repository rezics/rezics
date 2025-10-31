import {useFixtureInput} from 'react-cosmos/client';
import {useEffect, useMemo} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {createQueryClient} from '@/api/react-query/tsr';
import {tagQueries} from '@/api/tag';
import type {TagDTO} from '@package/contract';
import {BookTagsComplete} from './BookTagsExample';

function seed(qc: any, bookUnitId: string, type: string, tags: TagDTO[]) {
  const key = tagQueries.list({
    objectId: bookUnitId,
    type,
    limit: 100,
  }).queryKey;
  qc.setQueryData(key, {tags, total: tags.length});
}

export default function Fixture() {
  const qc = useMemo(() => createQueryClient(), []);

  const [controls] = useFixtureInput('Controls', {
    bookUnitId: 'book-1',
    genres: ['Fantasy', 'Sci-Fi'],
    authors: ['Author A', 'Author B'],
    others: ['Classic', 'Bestseller'],
  });

  useEffect(() => {
    seed(
      qc,
      controls.bookUnitId,
      'genre',
      controls.genres.map(
        (name, i) => ({id: `g${i}`, name, type: 'genre'} as TagDTO),
      ),
    );
    seed(
      qc,
      controls.bookUnitId,
      'author',
      controls.authors.map(
        (name, i) => ({id: `a${i}`, name, type: 'author'} as TagDTO),
      ),
    );
    seed(
      qc,
      controls.bookUnitId,
      'general',
      controls.others.map(
        (name, i) => ({id: `o${i}`, name, type: 'general'} as TagDTO),
      ),
    );
  }, [controls, qc]);

  return (
    <QueryClientProvider client={qc}>
      <div className="p-4 space-y-4">
        <h3 className="text-lg font-semibold">BookTagsComplete</h3>
        <BookTagsComplete bookUnitId={controls.bookUnitId} />
      </div>
    </QueryClientProvider>
  );
}
