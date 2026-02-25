import {useFixtureInput} from 'react-cosmos/client';
import {ChapterList} from './ChapterList';
import {useEffect, useState} from 'react';
import {generateChapterTree} from '@/mock/data/generateChapterTree';
import type {ChapterListProps} from './ChapterList';

const Fixture = () => {
  const [_data, setData] = useState<any>(null);

  useEffect(() => {
    setData(generateChapterTree());
  }, []);

  const [props] = useFixtureInput<ChapterListProps>('Props', {
    id: '1',
  });

  return (
    <div className="p-4 w-2xl">
      <ChapterList {...props} />
    </div>
  );
};

Fixture.displayName = 'ChapterListFixture';

export default Fixture;
