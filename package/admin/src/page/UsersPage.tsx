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
import {useQuery} from '@tanstack/react-query';

import {Page} from '@/page/Page';

import {userQueries} from '@package/api/user/user.queries';

function fmtDate(v?: string | Date) {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

export default function UsersPage() {
  const [q, setQ] = React.useState('');
  const [query, setQuery] = React.useState('');

  const listQuery = useQuery(
    userQueries.list(query.length > 0 ? {q: query, limit: 50} : {limit: 50}),
  );

  const users = listQuery.data?.users ?? [];
  const total = listQuery.data?.total;

  return (
    <Page title="Users" description="管理 User（搜索 / 列表 / 基础信息）">
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
              placeholder="q/email/slug/type..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') setQuery(q.trim());
              }}
              fullWidth
            />
            <IconButton
              aria-label="search"
              onClick={() => setQuery(q.trim())}
              sx={{alignSelf: {xs: 'flex-end', sm: 'center'}}}
            >
              <SearchIcon />
            </IconButton>
          </Stack>

          <Divider sx={{my: 2}} />

          {listQuery.isLoading ? (
            <Box sx={{display: 'flex', justifyContent: 'center', py: 6}}>
              <CircularProgress size={24} />
            </Box>
          ) : listQuery.isError ? (
            <Typography color="error" variant="body2">
              Failed to load users.
            </Typography>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary">
                {typeof total === 'number'
                  ? `Total: ${total}`
                  : `Count: ${users.length}`}
              </Typography>

              <Box sx={{overflowX: 'auto', mt: 1}}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{minWidth: 220}}>Unit ID</TableCell>
                      <TableCell sx={{minWidth: 180}}>Name</TableCell>
                      <TableCell sx={{minWidth: 160}}>Slug</TableCell>
                      <TableCell sx={{minWidth: 120}}>Type</TableCell>
                      <TableCell sx={{minWidth: 200}}>Roles</TableCell>
                      <TableCell sx={{minWidth: 120}}>Followers</TableCell>
                      <TableCell sx={{minWidth: 120}}>Followings</TableCell>
                      <TableCell sx={{minWidth: 170}}>Join Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.unitId} hover>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{fontFamily: 'monospace'}}
                          >
                            {u.unitId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {u.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {u.slug ? `@${u.slug}` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {u.type ? <Chip size="small" label={u.type} /> : '-'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {u.permission?.role?.length
                              ? u.permission.role.join(', ')
                              : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{u.followersCount ?? '-'}</TableCell>
                        <TableCell>{u.followingsCount ?? '-'}</TableCell>
                        <TableCell>{fmtDate(u.joinDate)}</TableCell>
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
