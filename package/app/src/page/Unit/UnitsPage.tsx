import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Tabs, Tab, Box, Tooltip, Chip, Paper, Typography} from '@mui/material';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {Link, useSearchParams} from 'wouter';

import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from '@/component/Common/Navigation/Pagination';
import type {UnitDTO, UnitType} from '@package/contract';
import {SimpleSearchInput} from '@/component/Search/SimpleSearchInput';
import {buildUnitUrl} from '@/util/buildUrlUtil';
import {buildMeiliUnitQuery} from '@/api/meili/meili.queries';

type Unit = UnitDTO;

type UnitsPageMode = 'tab' | 'single';

function defaultChildren(units: Unit[]) {
  return (
    <div className="space-y-3">
      {units.map(item => (
        <Paper
          key={item.id}
          elevation={2}
          className="flex items-start justify-between rounded-md px-3 py-2"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Tooltip title="打开内容页面" placement="top">
                <Link to={buildUnitUrl(item)}>
                  <Chip
                    label={item.type || 'UNKNOWN'}
                    size="small"
                    variant="outlined"
                    onClick={() => {}}
                    className="text-[11px]"
                  />
                </Link>
              </Tooltip>
              <Typography
                variant="subtitle1"
                className="font-semibold truncate mb-1"
              >
                {item.title || '(未命名内容)'}
              </Typography>
            </div>
            {item.content && (
              <Typography
                variant="body2"
                color="textSecondary"
                className="line-clamp-4"
              >
                {item.content}
              </Typography>
            )}
          </div>
        </Paper>
      ))}
    </div>
  );
}

export interface UnitsPageProps {
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
  types = ['UNIT', 'REVIEW', 'REMARK', 'QUOTE', 'BOOK'],
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

  function mapUnitResponse(unitResp) {
    return unitResp;
  }

  const {queryKey, queryFn} = buildMeiliUnitQuery(
    tab === 'UNIT' ? undefined : (tab as keyof typeof UnitType),
    startMap[tab] ?? 0,
    targetUnitId ?? '',
    keyword,
    EXTERNAL_PAGE_SIZE,
    mapUnitResponse,
  );

  const {data: activeData, isLoading} = useQuery({
    queryKey,
    queryFn,
  });

  function handleNeedMoreData(page: number) {
    const externalStart = (page - 1) * EXTERNAL_PAGE_SIZE;
    const t = tab;
    setStartMap(prev => ({...prev, [t]: externalStart}));
  }

  async function handlePreRequestData(page: number) {
    const start = (page - 1) * EXTERNAL_PAGE_SIZE;
    const {queryKey, queryFn} = buildMeiliUnitQuery(
      tab === 'UNIT' ? undefined : (tab as keyof typeof UnitType),
      start,
      targetUnitId ?? '',
      keyword,
      EXTERNAL_PAGE_SIZE,
      mapUnitResponse,
    );
    const nextData = await queryClient.fetchQuery({queryKey, queryFn});
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
          <div className="mb-4">
            <SimpleSearchInput
              onSearch={info => {
                setKeyword(info ?? '');
              }}
              defaultValue={{keyword: keyword ?? ''}}
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
