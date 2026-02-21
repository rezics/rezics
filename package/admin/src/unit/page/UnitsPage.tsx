import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {useMatchRoute} from '@tanstack/react-router';

import {unitQueries, type UnitDTO} from '@package/api/unit/unit';
import {meiliUnitApi} from '@package/api/meili/meili.api';

import {Page} from '@/core/layout/Page';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {type PaginatedColumn} from '@/component/table/PaginatedTable';
import {SearchablePaginatedTableCard} from '@/component/list/SearchablePaginatedTableCard';
import {PaginatedTable} from '@/component/table/PaginatedTable';
import {fmtDate} from '@/util/format';

export default function UnitsPage() {
  const matchRoute = useMatchRoute();
  const isMeiliMode = Boolean(matchRoute({to: '/units/meili'}));

  const [q, setQ] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);

  const trimmedQuery = query.trim();
  const start = page * limit;

  React.useEffect(() => {
    setQ('');
    setQuery('');
    setPage(0);
    setLimit(20);
  }, [isMeiliMode]);

  const listQuery = useQuery({
    ...unitQueries.list({start, limit}),
    enabled: !isMeiliMode && trimmedQuery.length === 0,
  });

  const searchQuery = useQuery({
    ...unitQueries.search(trimmedQuery, {start, limit}),
    enabled: !isMeiliMode && trimmedQuery.length > 0,
  });

  const meiliQuery = useQuery({
    queryKey: ['meili-units', page, limit, query],
    queryFn: () =>
      meiliUnitApi.unitSearch({start, limit, q: query || undefined}),
    enabled: isMeiliMode,
  });

  const normalQuery = trimmedQuery.length > 0 ? searchQuery : listQuery;
  const data = isMeiliMode ? meiliQuery.data : normalQuery.data;
  const units = data?.units ?? [];
  const total = data?.total;

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<UnitDTO>[] = [
      {
        id: 'id',
        header: 'ID',
        minWidth: 220,
        cell: u => (
          <Typography variant="body2" sx={{fontFamily: 'monospace'}}>
            {u.id}
          </Typography>
        ),
      },
      {
        id: 'title',
        header: 'Title',
        minWidth: 220,
        cell: u => (
          <Typography variant="body2" fontWeight={600} noWrap>
            {u.title || '(no title)'}
          </Typography>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        minWidth: 120,
        cell: u => (u.type ? <Chip size="small" label={u.type} /> : '-'),
      },
      {
        id: 'status',
        header: 'Status',
        minWidth: 120,
        cell: u => u.status || '-',
      },
      {
        id: 'user',
        header: 'User',
        minWidth: 200,
        cell: u => (
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
        ),
      },
      {
        id: 'createdAt',
        header: 'Created',
        minWidth: 170,
        cell: u => fmtDate(u.createdAt),
      },
      {
        id: 'updatedAt',
        header: 'Updated',
        minWidth: 170,
        cell: u => fmtDate(u.updatedAt),
      },
      {
        id: 'actions',
        header: 'Actions',
        minWidth: 120,
        cell: u => (
          <Button
            size="small"
            component={Link}
            to={`/units/${u.id}`}
            variant="outlined"
          >
            Edit
          </Button>
        ),
      },
    ];
    return cols;
  }, []);

  return (
    <Page
      title={isMeiliMode ? 'Units (Meili)' : 'Units'}
      description={
        isMeiliMode ? '管理 Unit（Meili 搜索）' : '管理 Unit（普通列表）'
      }
    >
      {isMeiliMode ? (
        <SearchablePaginatedTableCard<UnitDTO>
          searchPlaceholder="title/content/userId/type..."
          q={q}
          onQChange={setQ}
          onSearch={() => {
            setPage(0);
            setQuery(q.trim());
          }}
          toolbarRight={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              component={Link}
              to="/units/create"
              sx={{whiteSpace: 'nowrap'}}
            >
              Create
            </Button>
          }
          isLoading={meiliQuery.isLoading}
          isError={meiliQuery.isError}
          error={meiliQuery.error}
          columns={columns}
          rows={units}
          getRowId={u => u.id}
          count={typeof total === 'number' ? total : 0}
          page={page}
          rowsPerPage={limit}
          onPageChange={nextPage => setPage(nextPage)}
          onRowsPerPageChange={next => {
            setLimit(next);
            setPage(0);
          }}
        />
      ) : (
        <Card>
          <CardContent>
            <Stack
              direction={{xs: 'column', sm: 'row'}}
              spacing={1.5}
              alignItems="stretch"
            >
              <TextField
                size="small"
                label="Search"
                placeholder="q/title/userId/type..."
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setPage(0);
                    setQuery(q.trim());
                  }
                }}
                fullWidth
              />
              <IconButton
                aria-label="search"
                onClick={() => {
                  setPage(0);
                  setQuery(q.trim());
                }}
                sx={{alignSelf: {xs: 'flex-end', sm: 'center'}}}
              >
                <SearchIcon />
              </IconButton>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                component={Link}
                to="/units/create"
                sx={{whiteSpace: 'nowrap'}}
              >
                Create
              </Button>
            </Stack>

            <Divider sx={{my: 2}} />

            {normalQuery.isLoading ? (
              <Box sx={{display: 'flex', justifyContent: 'center', py: 6}}>
                <CircularProgress size={24} />
              </Box>
            ) : normalQuery.isError ? (
              <Box>
                <Typography color="error" variant="body2">
                  Failed to load units.
                </Typography>
                {normalQuery.error ? (
                  <Typography color="error" variant="caption">
                    {String(normalQuery.error)}
                  </Typography>
                ) : null}
              </Box>
            ) : (
              <PaginatedTable<UnitDTO>
                columns={columns}
                rows={units}
                getRowId={u => u.id}
                count={typeof total === 'number' ? total : 0}
                page={page}
                rowsPerPage={limit}
                onPageChange={nextPage => setPage(nextPage)}
                onRowsPerPageChange={next => {
                  setLimit(next);
                  setPage(0);
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
