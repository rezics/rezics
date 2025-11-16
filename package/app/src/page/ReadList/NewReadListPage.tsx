import React, {useState} from 'react';
import {ReadListEditor} from './ReadListEditPage';
import {Button} from '@mui/material';
import {useCreateReadlistMutation} from '@/api/readlist/readlist.mutations';
import {useLocation} from 'wouter';

export const NewReadListPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [readlistData, setReadlistData] = useState<any>({
    books: [],
    reviews: [],
  });
  const createReadlistMutation = useCreateReadlistMutation({
    onSuccess: data => {
      navigate(`/readlist/${data.id}`);
    },
    onError: error => {
      console.error('create readlist failed', error);
    },
  });

  function handleSubmit() {
    const bookConnect = readlistData.books.map(book => book.unitId);
    const reviewConnect = readlistData.reviews.map(review => review.unitId);
    const order = readlistData.order;
    createReadlistMutation.mutate({
      book: bookConnect,
      review: reviewConnect,
      order: order,
      title: readlistData.title,
      content: readlistData.content,
      coverUrl: readlistData.coverUrl ?? '',
    });
  }

  const NewReadListHeader = (
    <div className="mb-4">
      <div className="flex items-center">
        <div className="text-2xl font-bold">新建书单</div>
        <div className="ml-auto">
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            新建书单
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ReadListEditor
      readlistData={readlistData}
      setReadlistData={setReadlistData}
      header={NewReadListHeader}
    />
  );
};

export default NewReadListPage;
