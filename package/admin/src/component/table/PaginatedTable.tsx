import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import React from 'react';

export type PaginatedColumn<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
};

export function PaginatedTable<T>({
  columns,
  rows,
  getRowId,
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  dense = true,
  stickyHeader = true,
  enablePageJump = true,
  sx,
}: {
  columns: PaginatedColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  count: number;
  page: number; // 0-based
  rowsPerPage: number;
  onPageChange: (nextPage: number) => void;
  onRowsPerPageChange: (nextRowsPerPage: number) => void;
  dense?: boolean;
  stickyHeader?: boolean;
  enablePageJump?: boolean;
  sx?: SxProps<Theme>;
}) {
  const totalPages = rowsPerPage > 0 ? Math.ceil(count / rowsPerPage) : 0;
  const [pageInput, setPageInput] = React.useState(() => String(page + 1));

  React.useEffect(() => {
    setPageInput(String(page + 1));
  }, [page]);

  const commitPageInput = React.useCallback(() => {
    if (!totalPages) return;

    if (!pageInput) {
      setPageInput(String(page + 1));
      return;
    }

    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page + 1));
      return;
    }

    const clamped = Math.min(Math.max(Math.trunc(parsed), 1), totalPages);
    setPageInput(String(clamped));

    const nextPage = clamped - 1;
    if (nextPage !== page) onPageChange(nextPage);
  }, [onPageChange, page, pageInput, totalPages]);

  return (
    <Box sx={sx}>
      <TableContainer sx={{overflowX: 'auto'}}>
        <Table size={dense ? 'small' : 'medium'} stickyHeader={stickyHeader}>
          <TableHead>
            <TableRow>
              {columns.map(c => (
                <TableCell
                  key={c.id}
                  sx={{minWidth: c.minWidth}}
                  align={c.align}
                >
                  {c.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => (
              <TableRow key={getRowId(row)} hover>
                {columns.map(c => (
                  <TableCell key={c.id} align={c.align}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <TablePagination
          component="div"
          count={count}
          page={page}
          onPageChange={(_, nextPage) => onPageChange(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={e => onRowsPerPageChange(Number(e.target.value))}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />

        {enablePageJump ? (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{px: 1, pb: 1, pt: {xs: 0, sm: 1}}}
          >
            <Typography variant="body2" color="text.secondary">
              Go to page
            </Typography>
            <TextField
              size="small"
              value={pageInput}
              onChange={e => {
                // Keep numeric only (avoid "e", "+", "-" from number inputs)
                const next = e.target.value.replace(/[^\d]/g, '');
                setPageInput(next);
              }}
              onBlur={commitPageInput}
              onKeyDown={e => {
                if (e.key === 'Enter') commitPageInput();
              }}
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
                'aria-label': 'go to page',
              }}
              sx={{width: 110}}
              disabled={!totalPages}
            />
            <Typography variant="body2" color="text.secondary">
              / {Math.max(totalPages, 1)}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={commitPageInput}
              disabled={!totalPages}
            >
              Go
            </Button>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
