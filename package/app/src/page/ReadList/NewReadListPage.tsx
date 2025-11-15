import React from 'react';
import {ReadListEditor} from './ReadListEditPage';

export const NewReadListPage: React.FC = () => {
  return (
    <ReadListEditor
      data={{books: [], reviews: []}}
      initialReviewIds={[]}
      header={<div className="mb-4 text-2xl font-bold">新建书单</div>}
    />
  );
};

export default NewReadListPage;
