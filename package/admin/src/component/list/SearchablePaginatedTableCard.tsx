import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';

import { PaginatedTable, type PaginatedColumn } from '@/component/table/PaginatedTable';

export function SearchablePaginatedTableCard<T>({
  title,
  description,
  searchLabel = 'Search',
  searchPlaceholder,
  q,
  onQChange,
  onSearch,
  toolbarRight,
  isLoading,
  isError,
  error,
  columns,
  rows,
  getRowId,
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: {
  title?: string;
  description?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  q: string;
  onQChange: (next: string) => void;
  onSearch: () => void;
  toolbarRight?: React.ReactNode;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  columns: PaginatedColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (nextPage: number) => void;
  onRowsPerPageChange: (nextRowsPerPage: number) => void;
}) {
  return (
    <>
      {title ? (
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>
          {title}
        </Typography>
      ) : null}
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      ) : null}

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems="stretch"
          >
            <TextField
              size="small"
              label={searchLabel}
              placeholder={searchPlaceholder}
              value={q}
              onChange={(e) => onQChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearch();
              }}
              fullWidth
            />
            <IconButton
              aria-label="search"
              onClick={onSearch}
              sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
            >
              <SearchIcon />
            </IconButton>
            {toolbarRight}
          </Stack>

          <Divider sx={{ my: 2 }} />

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={24} />
            </Box>
          ) : isError ? (
            <Box>
              <Typography color="error" variant="body2">
                Failed to load.
              </Typography>
              {error ? (
                <Typography color="error" variant="caption">
                  {String(error)}
                </Typography>
              ) : null}
            </Box>
          ) : (
            <PaginatedTable<T>
              columns={columns}
              rows={rows}
              getRowId={getRowId}
              count={count}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={onPageChange}
              onRowsPerPageChange={onRowsPerPageChange}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
