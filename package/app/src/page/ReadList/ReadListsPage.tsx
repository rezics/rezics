import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Card,
  CardContent,
  CardMedia,
  Stack,
  Typography,
} from '@mui/material';
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@/component/Common/Pagination.tsx';
import {Search} from '@/component/Search';
import type {SearchInfo} from '@/component/Search/searchParser';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {readlistQueries} from '@/api/readlist/readlist.queries';
import type {ReadlistDTO} from '@package/contract';

type Readlist = ReadlistDTO;

// Simple list view for Readlists
const ReadlistListView: React.FC<{readlists: Readlist[]}> = ({readlists}) => {
  return (
    <Stack direction="row" flexWrap="wrap" gap={2}>
      {readlists.map(item => (
        <Card
          key={item.id}
          variant="outlined"
          sx={{
            flexGrow: 1,
            flexBasis: {
              xs: '100%',
              sm: '48%',
              md: '31%',
              lg: '23%',
            },
            maxWidth: {xs: '100%', sm: '48%', md: '31%', lg: '23%'},
          }}
        >
          {item.coverUrl ? (
            <CardMedia
              component="img"
              height="160"
              image={item.coverUrl}
              alt={item.title}
            />
          ) : null}
          <CardContent>
            <Stack spacing={0.5}>
              <Typography variant="subtitle1" noWrap>
                {item.title}
              </Typography>
              {item.creator?.name && (
                <Typography variant="body2" color="text.secondary">
                  {item.creator.name}
                </Typography>
              )}
              {typeof item.likes === 'number' && (
                <Typography variant="caption" color="text.secondary">
                  ❤ {item.likes}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

type SortKey = 'time' | 'name' | 'popular' | 'agree';

type ReadlistsShowProps = {
  readlists: Readlist[];
  totalItems: number;
  isLoading: boolean;
  error: any;
  sortConfig: {
    type: SortKey;
    order: 'asc' | 'desc';
  };
  handleNeedMoreData: (page: number) => void;
  handlePreRequestData: (page: number) => Promise<number>;
  handleSortChange: (newSort: {type?: string; order?: 'asc' | 'desc'}) => void;
  EXTERNAL_PAGE_SIZE: number;
  setCurrentQuery: React.Dispatch<React.SetStateAction<SearchInfo>>;
  currentQuery: SearchInfo;
};

const ReadlistsShow = (
  {
    readlists,
    totalItems,
    isLoading,
    error,
    sortConfig,
    handleNeedMoreData,
    handlePreRequestData,
    handleSortChange,
    EXTERNAL_PAGE_SIZE,
    setCurrentQuery,
    currentQuery,
  }: ReadlistsShowProps,
  ref: React.Ref<UniversalPaginatorHandle>,
) => {
  const [currentPage, setCurrentPage] = useState(1);
  const universalPaginatorRef = useRef<UniversalPaginatorHandle>(null);

  useEffect(() => {
    console.log('currentQuery', currentQuery);
  }, [currentQuery]);

  useImperativeHandle(ref, () => ({
    resetPaginationPageNumber() {
      universalPaginatorRef.current?.resetPaginationPageNumber();
    },
  }));

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-4">
        <Search.Container onSearch={() => {}} placeholder="Search readlists" />
        <Alert severity="error" className="my-4">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4">
      <UniversalPaginator<Readlist>
        ref={universalPaginatorRef}
        data={readlists}
        totalExternalItems={totalItems}
        itemsPerPage={12}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={sortConfig.type}
        sortOrder={sortConfig.order}
        onSortChange={handleSortChange}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && readlists.length === 0}
        sortControl={
          <Search.Container
            onSearch={info => {
              setCurrentQuery({
                keyword: info.keyword ?? '',
                tags: info.tags ?? [],
              });
              console.log('onSearch', info);
            }}
            defaultValue={currentQuery}
            placeholder="Search readlists"
          />
        }
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      >
        {(currentPageItems: Readlist[]) => (
          <ReadlistListView readlists={currentPageItems} />
        )}
      </UniversalPaginator>
    </div>
  );
};

const ReadlistsShowRef = forwardRef(ReadlistsShow);

/**
 * 后续API调整，Service调整的问题，是否要切换到 unit 查询，还是继续用独立服务。
 * @returns ReadListsPage
 */
export function ReadListsPage() {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const EXTERNAL_PAGE_SIZE = 100;
  const [currentQuery, setCurrentQuery] = useState<SearchInfo>({
    keyword: '',
    tags: [],
  });
  const [start, setStart] = useState<number>(0);

  const {data, isLoading, error} = useQuery(
    readlistQueries.list({
      start,
      limit: EXTERNAL_PAGE_SIZE,
      q: currentQuery.keyword ?? '',
      tags: currentQuery.tags?.join(',') ?? '',
    }),
  );

  function handleNeedMoreData(page: number) {
    setStart((page - 1) * EXTERNAL_PAGE_SIZE);
  }

  const queryClient = useQueryClient();
  async function handlePreRequestData(page: number) {
    const data = await queryClient.fetchQuery(
      readlistQueries.list({
        start: (page - 1) * EXTERNAL_PAGE_SIZE,
        limit: EXTERNAL_PAGE_SIZE,
        q: currentQuery.keyword ?? '',
        tags: currentQuery.tags?.join(',') ?? '',
      }),
    );
    console.log('handlePreRequestData', data, page);
    return data?.readlists?.length ?? 0;
  }

  useEffect(() => {
    console.log('data', data);
  }, [data]);

  useEffect(() => {
    ref.current?.resetPaginationPageNumber();
    console.log('currentQuery', currentQuery);
  }, [currentQuery]);

  const readlists: Readlist[] = useMemo(() => data?.readlists ?? [], [data]);
  const totalItems: number = data?.total ?? 0;

  const [sortConfig, setSortConfig] = useState<{
    type: SortKey;
    order: 'asc' | 'desc';
  }>({
    type: 'time',
    order: 'desc',
  });

  const handleSortChange = (newSort: {
    type?: string;
    order?: 'asc' | 'desc';
  }) => {
    console.log('handleSortChange, newSort', newSort);
    setSortConfig(prev => ({
      type: (newSort.type as SortKey) ?? prev.type,
      order: newSort.order ?? prev.order,
    }));
  };

  return (
    <ReadlistsShowRef
      ref={ref}
      readlists={readlists}
      totalItems={totalItems}
      isLoading={isLoading}
      error={error}
      currentQuery={currentQuery}
      setCurrentQuery={setCurrentQuery}
      sortConfig={sortConfig}
      handleNeedMoreData={handleNeedMoreData}
      handlePreRequestData={handlePreRequestData}
      handleSortChange={handleSortChange}
      EXTERNAL_PAGE_SIZE={EXTERNAL_PAGE_SIZE}
    />
  );
}
