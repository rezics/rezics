import {ArrowDownward, ArrowUpward} from '@mui/icons-material';
import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  PaginationItem,
  Paper,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  useImperativeHandle,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import React from 'react';
import {useTranslation} from 'react-i18next';

/**
 * example:
 * ```ts
 *   const [sortConfig, setSortConfig] = useState<{
 *       type: "time" | "name" | "popular" | "agree";
 *       order: "asc" | "desc";
 *   }>({
 *       type: "popular",
 *       order: "desc",
 *   });
 *   ```
 */
export interface SortControlsProps {
  sortType: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (newSort: {type?: string; order?: 'asc' | 'desc'}) => void;
}
/**
 * SortControls
 * @param {SortControlsProps} props
 */
const SortControls: React.FC<SortControlsProps> = ({
  sortType,
  sortOrder,
  onSortChange,
}) => {
  const sortOptions = [
    {value: 'time', label: '按时间'},
    {value: 'name', label: '按名称'},
    {value: 'popular', label: '按热度'},
    {value: 'agree', label: '按赞同数'},
  ];
  return (
    <Paper elevation={1} sx={{p: 2, mb: 2, borderRadius: 2}}>
      <Grid container spacing={2} alignItems="center">
        <Grid sx={{xs: 12, sm: 'auto'}}>
          <FormControl sx={{minWidth: 150}}>
            <InputLabel>排序方式</InputLabel>
            <Select
              value={sortType}
              label="排序方式"
              onChange={e =>
                onSortChange({
                  type: e.target.value as string,
                })
              }
            >
              {sortOptions.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid sx={{xs: 12, sm: 'auto'}}>
          <ToggleButtonGroup
            value={sortOrder}
            exclusive
            onChange={(_, v: 'asc' | 'desc' | null) =>
              v && onSortChange({order: v})
            }
          >
            <ToggleButton value="desc">
              <ArrowDownward />
              &nbsp; 降序
            </ToggleButton>
            <ToggleButton value="asc">
              <ArrowUpward />
              &nbsp; 升序
            </ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      </Grid>
    </Paper>
  );
};

interface PaginationBarProps {
  page: number;
  dataLength: number;
  totalPages: number;
  onPageChange: (event: React.ChangeEvent<unknown>, page: number) => void;
}
const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  dataLength,
  totalPages,
  onPageChange,
}) => {
  const {t} = useTranslation();
  useEffect(() => {
    console.log(
      'PaginationBar',
      JSON.stringify({
        page: page,
        dataLength: dataLength,
        totalPages: totalPages,
      }),
    );
  }, [page, dataLength, totalPages]);
  if (totalPages <= 1) return null;
  return (
    <div>
      <Box sx={{display: 'flex', justifyContent: 'center', p: 2, mt: 2}}>
        <Pagination
          // count={totalPages}
          count={dataLength}
          page={page}
          onChange={onPageChange}
          color="primary"
          showFirstButton
          showLastButton
        />
        {/* <Button
          variant="text"
          style={{bottom: '3px'}}
          onClick={() => onPageChange(null as any, page + 1)}
        >
          Next
        </Button> */}
      </Box>
      <div className="text-sm text-gray-500 text-center">
        {t('search.pagination.tips')}
      </div>
    </div>
  );
};

interface UniversalPaginatorProps<T> extends SortControlsProps {
  ref: React.Ref<UniversalPaginatorHandle>;
  data: T[];
  totalExternalItems: number;
  itemsPerPage?: number;
  externalItemsPerPage?: number;
  /**
   *
   * @param externalPage - the page number need to query
   * @returns
   */
  requestData: (externalPage: number) => void;
  preRequestData?: (externalPage: number) => Promise<number>;
  children: (currentPageItems: T[]) => React.ReactNode;
  disableSortControl?: boolean;
  sortControl?: React.ReactElement<SortControlsProps>;
  isLoading?: boolean;
  currentPage: number;
  setCurrentPage: (page: number) => void;
}

export type UniversalPaginatorHandle = {
  resetPaginationPageNumber: () => void;
};

/**
 * UniversalPaginator
 * @param {UniversalPaginatorProps<T>} props
 * @returns {React.ReactNode}
 * @todo Add an option to keep the page scrolled to the bottom to prevent it from jumping to the top when new data loads.
 */
export const UniversalPaginator = <T,>({
  ref,
  data,
  totalExternalItems,
  itemsPerPage = 30,
  externalItemsPerPage = 100,
  sortType,
  sortOrder,
  onSortChange,
  requestData,
  preRequestData,
  children,
  disableSortControl = false,
  sortControl,
  isLoading = false,
  currentPage = 1,
  setCurrentPage,
}: UniversalPaginatorProps<T>) => {
  const [paginationPageNumber, setPaginationPageNumber] = useState<number>(
    externalItemsPerPage / itemsPerPage,
  );
  useEffect(() => {
    console.log('paginationPageNumber', paginationPageNumber);
  }, [paginationPageNumber]);
  const internalPagesPerExternalPage = useMemo(
    () => Math.ceil(externalItemsPerPage / itemsPerPage),
    [externalItemsPerPage, itemsPerPage],
  );
  const externalPage = useMemo(
    () => Math.ceil(currentPage / internalPagesPerExternalPage),
    [currentPage, internalPagesPerExternalPage],
  );
  const rangeStartPage = useMemo(
    () => (externalPage - 1) * internalPagesPerExternalPage + 1,
    [externalPage, internalPagesPerExternalPage],
  );
  const globalStartIndex = useMemo(
    () =>
      (currentPage - rangeStartPage) * itemsPerPage +
      (externalPage - 1) * externalItemsPerPage,
    [
      currentPage,
      rangeStartPage,
      itemsPerPage,
      externalPage,
      externalItemsPerPage,
    ],
  );

  useImperativeHandle(ref, () => ({
    async resetPaginationPageNumber() {
      console.log('resetPaginationPageNumber');
      const result = await preRequestData?.(1);
      if (result) {
        const nextPaginationPageNumber =
          externalPage * Math.ceil(externalItemsPerPage / itemsPerPage);
        const dataMaxPageNumber = Math.ceil(result / itemsPerPage);
        setPaginationPageNumber(
          Math.min(dataMaxPageNumber, nextPaginationPageNumber),
        );
        console.log(
          'resetPaginationPageNumber',
          JSON.stringify({
            result: result,
            externalPage: externalPage,
            externalItemsPerPage: externalItemsPerPage,
            itemsPerPage: itemsPerPage,
            dataMaxPageNumber: dataMaxPageNumber,
            nextPaginationPageNumber: nextPaginationPageNumber,
          }),
        );
        handlePageChange(null as any, 1);
      }
    },
  }));

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalExternalItems / itemsPerPage)),
    [totalExternalItems, itemsPerPage],
  );

  const currentPageItems = useMemo(() => {
    const startIndex = (currentPage - rangeStartPage) * itemsPerPage;
    console.log(
      'currentPageItems',
      'currentPage',
      currentPage,
      'globalStartIndex',
      globalStartIndex,
      'externalPage',
      externalPage,
      'data.length',
      data.length,
    );
    console.log(
      'rangeStartPage',
      rangeStartPage,
      'startIndex',
      startIndex,
      'endIndex',
      startIndex + itemsPerPage - 1,
    );
    return data.slice(startIndex, startIndex + itemsPerPage); // no minus 1, because slice is not inclusive
  }, [data, currentPage, itemsPerPage, externalItemsPerPage]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
    console.log(
      'pageChange',
      JSON.stringify({
        newPage: newPage,
        paginationPageNumber: paginationPageNumber,
        rangeStartPage: rangeStartPage,
        globalStartIndex: globalStartIndex,
        internalPagesPerExternalPage: internalPagesPerExternalPage,
        externalPage: externalPage,
      }),
    );
    requestData(Math.ceil(newPage / internalPagesPerExternalPage));
    setCurrentPage(newPage);
    const isTheLastPage = () => {
      return newPage >= paginationPageNumber;
    };
    if (isTheLastPage()) {
      const externalPage = Math.ceil(newPage / internalPagesPerExternalPage);
      console.log('handlePageChange');
      preRequestData?.(externalPage + 1).then(result => {
        console.log('preRequestData', result);
        if (result) {
          const nextPaginationPageNumber =
            externalPage * Math.ceil(externalItemsPerPage / itemsPerPage) +
            Math.ceil(result / itemsPerPage);
          setPaginationPageNumber(
            Math.max(paginationPageNumber, nextPaginationPageNumber),
          );
        }
      });
    }
  };

  return (
    <Box>
      {!disableSortControl &&
        (sortControl || (
          <SortControls
            sortType={sortType}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
          />
        ))}

      <Box sx={{minHeight: 300, position: 'relative'}}>
        {isLoading && (
          <LinearProgress
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
            }}
          />
        )}
        {children(currentPageItems)}
        {!isLoading && currentPageItems.length === 0 && (
          <Typography sx={{textAlign: 'center', p: 5}}>没有内容。</Typography>
        )}
      </Box>
      <PaginationBar
        page={currentPage}
        dataLength={paginationPageNumber}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </Box>
  );
};
