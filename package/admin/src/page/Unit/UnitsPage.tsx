import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { unitQueries, type UnitDTO } from '@package/api/unit/unit';

import { Page } from '@/page/Page';

function fmtDate(v?: string | Date) {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

export default function UnitsPage() {
  const [q, setQ] = React.useState('');
  const [query, setQuery] = React.useState('');

  const listQuery = useQuery(
    query.length > 0
      ? unitQueries.list({ q: query, limit: 50 })
      : unitQueries.list({ limit: 50 }),
  );

  const units = listQuery.data?.units ?? [];
  const total = listQuery.data?.total;

  return (
    <Page title="Units" description="管理 Unit（搜索 / 列表 / 基础信息）">
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch">
            <TextField
              size="small"
              label="Search"
              placeholder="title/content/userId/type..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setQuery(q.trim());
              }}
              fullWidth
            />
            <IconButton
              aria-label="search"
              onClick={() => setQuery(q.trim())}
              sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
            >
              <SearchIcon />
            </IconButton>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {listQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={24} />
            </Box>
          ) : listQuery.isError ? (
            <Typography color="error" variant="body2">
              Failed to load units.
            </Typography>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary">
                {typeof total === 'number' ? `Total: ${total}` : `Count: ${units.length}`}
              </Typography>

              <Box sx={{ overflowX: 'auto', mt: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 220 }}>ID</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>Title</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Type</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Status</TableCell>
                      <TableCell sx={{ minWidth: 200 }}>User</TableCell>
                      <TableCell sx={{ minWidth: 170 }}>Created</TableCell>
                      <TableCell sx={{ minWidth: 170 }}>Updated</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {units.map((u: UnitDTO) => (
                      <TableRow key={u.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {u.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {u.title || '(no title)'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {u.type ? <Chip size="small" label={u.type} /> : '-'}
                        </TableCell>
                        <TableCell>{u.status || '-'}</TableCell>
                        <TableCell>
                          <Stack spacing={0}>
                            <Typography variant="body2" noWrap>
                              {u.user?.name ?? u.userId}
                            </Typography>
                            {u.user?.slug ? (
                              <Typography variant="caption" color="text.secondary" noWrap>
                                @{u.user.slug}
                              </Typography>
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell>{fmtDate(u.createdAt)}</TableCell>
                        <TableCell>{fmtDate(u.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

