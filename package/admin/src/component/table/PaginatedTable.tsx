import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
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
  sx?: SxProps<Theme>;
}) {
  return (
    <Box sx={sx}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size={dense ? 'small' : 'medium'} stickyHeader={stickyHeader}>
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell
                  key={c.id}
                  sx={{ minWidth: c.minWidth }}
                  align={c.align}
                >
                  {c.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getRowId(row)} hover>
                {columns.map((c) => (
                  <TableCell key={c.id} align={c.align}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={count}
        page={page}
        onPageChange={(_, nextPage) => onPageChange(nextPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) =>
          onRowsPerPageChange(Number(e.target.value))
        }
        rowsPerPageOptions={[10, 20, 50, 100]}
      />
    </Box>
  );
}

