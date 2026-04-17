import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
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
} from "@mui/material";
import { meiliUserApi } from "@rezics/api/meili/meili.api";
import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";

import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute } from "@tanstack/react-router";
import React from "react";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";

function fmtDate(v?: string | Date) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

export default function UserListPage() {
  const matchRoute = useMatchRoute();
  const isMeiliMode = Boolean(matchRoute({ to: "/users/meili" }));

  const [q, setQ] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(20);

  React.useEffect(() => {
    setQ("");
    setQuery("");
    setPage(0);
    setLimit(20);
  }, []);

  const listQuery = useQuery({
    ...userQueries.adminList({
      page: page + 1,
      limit,
      ...(query ? { q: query } : {}),
    }),
    enabled: !isMeiliMode,
  });

  const meiliQuery = useQuery({
    queryKey: ["meili-users", page, limit, query],
    queryFn: () =>
      meiliUserApi.userSearch({
        q: query || undefined,
        page: page + 1,
        limit,
      }),
    enabled: isMeiliMode,
  });

  const data = isMeiliMode ? meiliQuery.data : listQuery.data;

  const users = (data?.users ?? []) as UserDTO[];
  const total = data?.total ?? 0;

  const columns = React.useMemo(() => {
    const cols: PaginatedColumn<UserDTO>[] = [
      {
        id: "unitId",
        header: "Unit ID",
        minWidth: 220,
        cell: (u) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {u.unitId}
          </Typography>
        ),
      },
      {
        id: "email",
        header: "Email",
        minWidth: 240,
        cell: (u) => (
          <Typography variant="body2" noWrap>
            {u.email ?? "-"}
          </Typography>
        ),
      },
      {
        id: "name",
        header: "Name",
        minWidth: 160,
        cell: (u) => (
          <Typography variant="body2" fontWeight={700} noWrap>
            {u.name}
          </Typography>
        ),
      },
      {
        id: "slug",
        header: "Slug",
        minWidth: 160,
        cell: (u) => (
          <Typography variant="body2" noWrap>
            {u.slug ? `@${u.slug}` : "-"}
          </Typography>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        minWidth: 220,
        cell: (u) => (
          <Typography variant="body2" noWrap>
            {u.permission?.role?.length ? u.permission.role.join(", ") : "-"}
          </Typography>
        ),
      },
      {
        id: "joinDate",
        header: "Join Date",
        minWidth: 170,
        cell: (u) => fmtDate(u.joinDate),
      },
      {
        id: "actions",
        header: "Actions",
        minWidth: 120,
        cell: (u) => (
          <Button
            size="small"
            component={Link}
            to={`/users/${u.unitId}`}
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
      title={isMeiliMode ? "Users (Meili)" : "Users"}
      description={
        isMeiliMode
          ? "管理 User（Meili 搜索）"
          : "管理 User（普通列表 / 翻页 / 创建 / 编辑）"
      }
    >
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems="stretch"
          >
            <TextField
              size="small"
              label="Search"
              placeholder="q/email/slug..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
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
              sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
            >
              <SearchIcon />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              component={Link}
              to="/users/create"
              sx={{ whiteSpace: "nowrap" }}
            >
              Create
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {(isMeiliMode ? meiliQuery.isLoading : listQuery.isLoading) ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (isMeiliMode ? meiliQuery.isError : listQuery.isError) ? (
            <Typography color="error" variant="body2">
              Failed to load users.
            </Typography>
          ) : (
            <PaginatedTable<UserDTO>
              columns={columns}
              rows={users}
              getRowId={(u) => u.unitId}
              count={total}
              page={page}
              rowsPerPage={limit}
              onPageChange={(nextPage) => setPage(nextPage)}
              onRowsPerPageChange={(next) => {
                setLimit(next);
                setPage(0);
              }}
            />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
