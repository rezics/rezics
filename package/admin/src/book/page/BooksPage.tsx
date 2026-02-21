import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
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
import {useQuery} from '@tanstack/react-query';
import {useMatchRoute} from '@tanstack/react-router';

import {bookQueries, type BookDTO} from '@package/api/book/book';
import {meiliBookApi} from '@package/api/meili/meili.api';

import {Page} from '@/core/layout/Page';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {type PaginatedColumn} from '@/component/table/PaginatedTable';
import {SearchablePaginatedTableCard} from '@/component/list/SearchablePaginatedTableCard';
import {PaginatedTable} from '@/component/table/PaginatedTable';
import {fmtDate} from '@/util/format';

function joinNames(users?: Array<{name?: string | null}>): string {
  const names = users
    ?.map(u => u.name)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return names?.length ? names.join(', ') : '-';
}

export default function BooksPage() {
  const matchRoute = useMatchRoute();
  const isMeiliMode = Boolean(matchRoute({to: '/book/meili'}));

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
    ...bookQueries.list({start, limit}),
    enabled: !isMeiliMode && trimmedQuery.length === 0,
  });

  const searchQuery = useQuery({
    ...bookQueries.search(trimmedQuery, {start, limit}),
    enabled: !isMeiliMode && trimmedQuery.length > 0,
  });

  const meiliQuery = useQuery({
    queryKey: ['meili-books', page, limit, query],
    queryFn: () =>
      meiliBookApi.bookSearch({start, limit, keyword: query || undefined}),
    enabled: isMeiliMode,
  });

  const normalQuery = trimmedQuery.length > 0 ? searchQuery : listQuery;
  const data = isMeiliMode ? meiliQuery.data : normalQuery.data;
  const books = data?.books ?? [];
  const total = data?.total;

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<BookDTO>[] = [
      {
        id: 'unitId',
        header: 'Unit ID',
        minWidth: 220,
        cell: b => (
          <Typography variant="body2" sx={{fontFamily: 'monospace'}}>
            {b.unitId}
          </Typography>
        ),
      },
      {
        id: 'title',
        header: 'Title',
        minWidth: 260,
        cell: b => (
          <Typography variant="body2" fontWeight={700} noWrap>
            {b.title || '(no title)'}
          </Typography>
        ),
      },
      {
        id: 'isbn',
        header: 'ISBN',
        minWidth: 160,
        cell: b => b.isbn || '-',
      },
      {
        id: 'author',
        header: 'Author',
        minWidth: 220,
        cell: b => joinNames(b.author as any),
      },
      {
        id: 'user',
        header: 'User',
        minWidth: 200,
        cell: b => (
          <Stack spacing={0}>
            <Typography variant="body2" noWrap>
              {b.user?.name ?? b.userId ?? '-'}
            </Typography>
            {b.user?.slug ? (
              <Typography variant="caption" color="text.secondary" noWrap>
                @{b.user.slug}
              </Typography>
            ) : null}
          </Stack>
        ),
      },
      {
        id: 'createdAt',
        header: 'Created',
        minWidth: 170,
        cell: b => fmtDate(b.createdAt),
      },
      {
        id: 'updatedAt',
        header: 'Updated',
        minWidth: 170,
        cell: b => fmtDate(b.updatedAt),
      },
      {
        id: 'actions',
        header: 'Actions',
        minWidth: 140,
        cell: b => (
          <Button
            size="small"
            component={Link}
            to={`/units/${b.unitId}`}
            variant="outlined"
          >
            Edit Unit
          </Button>
        ),
      },
    ];
    return cols;
  }, []);

  return (
    <Page
      title={isMeiliMode ? 'Books (Meili)' : 'Books'}
      description={
        isMeiliMode ? '管理 Book（Meili 搜索）' : '管理 Book（普通列表）'
      }
    >
      {isMeiliMode ? (
        <SearchablePaginatedTableCard<BookDTO>
          searchPlaceholder="title/isbn/keyword..."
          q={q}
          onQChange={setQ}
          onSearch={() => {
            setPage(0);
            setQuery(q.trim());
          }}
          isLoading={meiliQuery.isLoading}
          isError={meiliQuery.isError}
          error={meiliQuery.error}
          columns={columns}
          rows={books}
          getRowId={b => b.unitId}
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
                placeholder="q/title/isbn..."
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
            </Stack>
            <Divider sx={{my: 2}} />

            {(isMeiliMode ? meiliQuery.isLoading : normalQuery.isLoading) ? (
              <Box sx={{display: 'flex', justifyContent: 'center', py: 6}}>
                <CircularProgress size={24} />
              </Box>
            ) : (isMeiliMode ? meiliQuery.isError : normalQuery.isError) ? (
              <Box>
                <Typography color="error" variant="body2">
                  Failed to load books.
                </Typography>
                {(isMeiliMode ? meiliQuery.error : normalQuery.error) ? (
                  <Typography color="error" variant="caption">
                    {String(isMeiliMode ? meiliQuery.error : normalQuery.error)}
                  </Typography>
                ) : null}
              </Box>
            ) : (
              <PaginatedTable<BookDTO>
                columns={columns}
                rows={books}
                getRowId={b => b.unitId}
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
