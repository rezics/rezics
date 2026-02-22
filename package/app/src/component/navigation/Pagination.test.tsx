import {useFixtureInput} from 'react-cosmos/client';
import {useRef, useState} from 'react';
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from './Pagination';

type Item = {
  id: number;
  title: string;
};

const mockData: Item[] = Array.from({length: 80}, (_, index) => ({
  id: index + 1,
  title: `Item ${index + 1}`,
}));

export default function PaginationTest() {
  const [props] = useFixtureInput('Props', {
    itemsPerPage: 10,
    externalItemsPerPage: 40,
    totalExternalItems: 80,
    isLoading: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState<{type: string; order: 'asc' | 'desc'}>({
    type: 'time',
    order: 'desc',
  });
  const paginatorRef = useRef<UniversalPaginatorHandle>(null);

  return (
    <div className="p-4">
      <UniversalPaginator<Item>
        ref={paginatorRef}
        data={mockData}
        totalExternalItems={props.totalExternalItems}
        itemsPerPage={props.itemsPerPage}
        externalItemsPerPage={props.externalItemsPerPage}
        sortType={sort.type}
        sortOrder={sort.order}
        onSortChange={next =>
          setSort(prev => ({...prev, ...next}))
        }
        requestData={() => {}}
        preRequestData={async () => props.totalExternalItems}
        isLoading={props.isLoading}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      >
        {items => (
          <div className="space-y-2">
            {items.map(item => (
              <div
                key={item.id}
                className="rounded border border-gray-200 bg-white px-3 py-2"
              >
                {item.title}
              </div>
            ))}
          </div>
        )}
      </UniversalPaginator>
    </div>
  );
}
