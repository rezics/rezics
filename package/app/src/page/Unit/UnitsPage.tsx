import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Tabs, Tab, Box} from '@mui/material';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useSearchParams} from 'wouter';

import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@/component/Common/Pagination.tsx';
import {unitQueries} from '@/api/unit/unit.queries';
import type {UnitDTO} from '@package/contract';
import {Search} from '@/component/Search';

type Unit = UnitDTO;

type UnitsPageMode = 'tab' | 'single';

function defaultChildren(units: Unit[]) {
  return (
    <div className="space-y-3">
      {units.map(item => (
        <div key={item.id} className="p-3 border rounded">
          <div className="text-sm text-gray-500">
            {item.user?.name || 'Unknown'} ·{' '}
            {(item.createdAt || '')?.toString()}
          </div>
          {item.title && <div className="font-medium mt-1">{item.title}</div>}
          {item.content && (
            <div className="text-gray-700 mt-1">
              {item.content.length > 160
                ? `${item.content.slice(0, 160)}…`
                : item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface UnitsPageProps {
  /**
   * Mode of the page:
   * - 'tab': show tabs to switch between multiple unit types
   * - 'single': only query and render a single `type`, no tabs UI
   */
  mode?: UnitsPageMode;
  /**
   * The unit type to query when `mode` is 'single'
   */
  type?: string;
  /**
   * Unit types to display when `mode` is 'tab'
   */
  types?: string[];
  /**
   * Optional user filter
   */
  userId?: string;
  /**
   * Optional target unit filter (e.g., bookId)
   */
  targetUnitId?: string;

  children?: (units: any[]) => React.ReactNode;
}

export const UnitsPage: React.FC<UnitsPageProps> = ({
  mode = 'tab',
  type,
  types = ['REVIEW', 'REMARK', 'QUOTE'],
  userId,
  targetUnitId,
  children = defaultChildren,
}) => {
  const ref = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const isSingle = mode === 'single';

  const EXTERNAL_PAGE_SIZE = 50;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [keyword, setKeyword] = useState<string>('');
  const [tab, setTab] = useState<string>(types[0] ?? '');
  const [startMap, setStartMap] = useState<Record<string, number>>({});

  // initialize tab from URL (only in tab mode)
  useEffect(() => {
    if (isSingle) {
      if (type && types.includes(type)) {
        setTab(type);
      } else if (types.length > 0) {
        setTab(types[0]);
      }
      return;
    }
    const tabParam = searchParams.get('tab');
    if (tabParam && types.includes(tabParam)) {
      setTab(tabParam);
    } else if (types.length > 0) {
      setTab(types[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isSingle]);

  // ensure startMap has keys for current tabTypes
  useEffect(() => {
    setStartMap(prev => {
      const next = {...prev};
      types.forEach(t => {
        if (next[t] == null) next[t] = 0;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {data: activeData, isLoading} = useQuery(
    unitQueries.list({
      type: tab,
      userId,
      targetUnitId,
      q: keyword || undefined,
      start: startMap[tab] ?? 0,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  function handleNeedMoreData(page: number) {
    const externalStart = (page - 1) * EXTERNAL_PAGE_SIZE;
    const t = tab;
    setStartMap(prev => ({...prev, [t]: externalStart}));
  }

  async function handlePreRequestData(page: number) {
    const t = tab;
    const query = unitQueries.list({
      type: t,
      userId,
      targetUnitId,
      q: keyword || undefined,
      start: (page - 1) * EXTERNAL_PAGE_SIZE,
      limit: EXTERNAL_PAGE_SIZE,
    });
    const nextData = await queryClient.fetchQuery(query);
    return nextData?.units?.length ?? 0;
  }

  useEffect(() => {
    ref.current?.resetPaginationPageNumber?.();
    setCurrentPage(1);
  }, [tab, keyword]);

  const units: Unit[] = useMemo(() => activeData?.units ?? [], [activeData]);
  const totalItems: number = activeData?.total ?? 10000;

  return (
    <div className="mx-auto max-w-7xl p-4 mt-4">
      <UniversalPaginator<Unit>
        ref={ref}
        data={units}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={undefined as any}
        sortOrder={undefined as any}
        onSortChange={() => {}}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && units.length === 0}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        sortControl={
          <div>
            <Search.Container
              onSearch={info => {
                setKeyword(info.keyword ?? '');
              }}
              defaultValue={{keyword, tags: []}}
              placeholder="Search units"
            />
            {!isSingle && (
              <Box sx={{borderBottom: 1, borderColor: 'divider', mt: 2, mb: 2}}>
                <Tabs
                  value={tab}
                  onChange={(_, v) => setTab(v)}
                  aria-label="unit type tabs"
                >
                  {types.map(t => (
                    <Tab key={t} label={t} value={t} />
                  ))}
                </Tabs>
              </Box>
            )}
          </div>
        }
      >
        {(currentPageItems: Unit[]) => children(currentPageItems)}
      </UniversalPaginator>
    </div>
  );
};

export default UnitsPage;
