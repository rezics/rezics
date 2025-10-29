import {useFixtureInput} from 'react-cosmos/client';
import {faker} from '@faker-js/faker';
import {BookDescription} from './index';
import type {BookDescriptionShowProps} from './types';
import {useEffect, useState} from 'react';

const Fixture = () => {
  const [description, setDescription] = useState<string>('');
  const [sentence, setSentence] = useState<string>('');
  const [paragraph, setParagraph] = useState<string>('');

  useEffect(() => {
    // faker 只在组件第一次挂载时生成
    setDescription(faker.lorem.paragraphs({min: 2, max: 5}));
    setSentence(faker.lorem.sentence());
    setParagraph(faker.lorem.paragraph());
  }, []);

  const [props] = useFixtureInput<BookDescriptionShowProps>('Props', {
    description: description,
  });

  return (
    <div className="p-4 max-w-2xl">
      <h3 className="mb-4 text-lg font-semibold">Book Description Component</h3>
      <div className="border border-gray-200 rounded-lg p-4">
        <BookDescription.Show {...props} />
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <h4 className="font-medium mb-2">Different lengths</h4>
          <div className="space-y-2">
            <div className="border rounded p-2">
              <BookDescription.Show description={sentence} />
            </div>
            <div className="border rounded p-2">
              <BookDescription.Show description={paragraph} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Fixture.displayName = 'BookDescriptionFixture';

export default Fixture;
