import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { lowScoreTagsQuery } from "@rezics/api/tag/tag.queries";
import {
  useDeleteUnitTagMutation,
  usePatchUnitTagMutation,
} from "@rezics/api/tag/tag.mutations";
import {
  positionForNewTopPin,
  positionForNewBottomPin,
} from "@rezics/api/tag/fractional-index";
import {
  useDeleteRealmTagUnitMutation,
  usePatchRealmTagUnitMutation,
} from "@rezics/api/realm/realm.mutations";
import type {
  LowScoreTagsScope,
  RealmTagUnitDTO,
  UnitTagDTO,
} from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  type PaginatedColumn,
  PaginatedTable,
} from "@/components/table/PaginatedTable";
import { Page } from "@/core/layouts/Page";

type Row =
  | ({ kind: "global" } & UnitTagDTO)
  | ({ kind: "realm" } & RealmTagUnitDTO);

export default function LowScoreTagsPage() {
  const [scope, setScope] = React.useState<LowScoreTagsScope>("global");
  const [thresholdInput, setThresholdInput] = React.useState("-100");
  const [realmInput, setRealmInput] = React.useState("");
  const [appliedRealm, setAppliedRealm] = React.useState("");
  const [appliedThreshold, setAppliedThreshold] = React.useState(-100);
  const [page, setPage] = React.useState(0);
  const [limit, setLimit] = React.useState(50);

  const query = useQuery(
    lowScoreTagsQuery({
      scope,
      threshold: appliedThreshold,
      realmUnitId:
        scope === "realm" && appliedRealm.trim().length > 0
          ? appliedRealm.trim()
          : undefined,
      limit: 200,
    }),
  );

  const deleteUnitTag = useDeleteUnitTagMutation();
  const patchUnitTag = usePatchUnitTagMutation();
  const deleteRealmTagUnit = useDeleteRealmTagUnitMutation();
  const patchRealmTagUnit = usePatchRealmTagUnitMutation();

  const rows: Row[] = React.useMemo(() => {
    const data = query.data;
    if (!data) return [];
    if (data.scope === "global" && data.unitTags) {
      return data.unitTags.map((r) => ({ kind: "global" as const, ...r }));
    }
    if (data.scope === "realm" && data.realmTagUnits) {
      return data.realmTagUnits.map((r) => ({
        kind: "realm" as const,
        ...r,
      }));
    }
    return [];
  }, [query.data]);

  const start = page * limit;
  const visibleRows = rows.slice(start, start + limit);

  const handleApplyFilters = () => {
    const parsed = Number.parseInt(thresholdInput, 10);
    if (Number.isFinite(parsed)) setAppliedThreshold(parsed);
    setAppliedRealm(realmInput);
    setPage(0);
  };

  const handleDelete = (row: Row) => {
    if (row.kind === "global") {
      deleteUnitTag.mutate({
        unitId: row.unitId,
        tagUnitId: row.tagUnitId,
      });
    } else {
      deleteRealmTagUnit.mutate({
        realmUnitId: row.realmUnitId,
        unitId: row.unitId,
        tagUnitId: row.tagUnitId,
      });
    }
  };

  const handleTogglePin = (row: Row) => {
    if (row.kind === "global") {
      if (row.pinned) {
        patchUnitTag.mutate({
          unitId: row.unitId,
          tagUnitId: row.tagUnitId,
          input: { pinned: false, position: null },
        });
      } else {
        patchUnitTag.mutate({
          unitId: row.unitId,
          tagUnitId: row.tagUnitId,
          input: { pinned: true, position: positionForNewBottomPin() },
        });
      }
    } else {
      if (row.pinned) {
        patchRealmTagUnit.mutate({
          realmUnitId: row.realmUnitId,
          unitId: row.unitId,
          tagUnitId: row.tagUnitId,
          input: { pinned: false, position: null },
        });
      } else {
        patchRealmTagUnit.mutate({
          realmUnitId: row.realmUnitId,
          unitId: row.unitId,
          tagUnitId: row.tagUnitId,
          input: { pinned: true, position: positionForNewTopPin() },
        });
      }
    }
  };

  const columns = React.useMemo<PaginatedColumn<Row>[]>(() => {
    const base: PaginatedColumn<Row>[] = [
      {
        id: "scope",
        header: "Scope",
        minWidth: 90,
        cell: (r) => (
          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
            {r.kind}
          </Typography>
        ),
      },
      ...(scope === "realm"
        ? [
            {
              id: "realm",
              header: "Realm",
              minWidth: 220,
              cell: (r: Row) =>
                r.kind === "realm" ? (
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {r.realmUnitId}
                  </Typography>
                ) : null,
            },
          ]
        : []),
      {
        id: "unit",
        header: "Unit",
        minWidth: 220,
        cell: (r) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {r.unitId}
          </Typography>
        ),
      },
      {
        id: "tag",
        header: "Tag",
        minWidth: 220,
        cell: (r) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {r.tagUnitId}
          </Typography>
        ),
      },
      {
        id: "score",
        header: "Score",
        minWidth: 90,
        cell: (r) => (
          <Typography
            variant="body2"
            color="error.main"
            fontWeight={600}
            sx={{ fontFamily: "monospace" }}
          >
            {r.score}
          </Typography>
        ),
      },
      {
        id: "voteCount",
        header: "Votes",
        minWidth: 80,
        cell: (r) => (
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {r.voteCount}
          </Typography>
        ),
      },
      {
        id: "pinned",
        header: "Pinned",
        minWidth: 80,
        cell: (r) => (r.pinned ? "Yes" : "-"),
      },
      {
        id: "actions",
        header: "Actions",
        minWidth: 130,
        cell: (r) => (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={r.pinned ? "Unpin" : "Pin"}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleTogglePin(r)}
                  disabled={
                    r.kind === "global"
                      ? patchUnitTag.isPending
                      : patchRealmTagUnit.isPending
                  }
                >
                  {r.pinned ? (
                    <PushPinIcon fontSize="small" />
                  ) : (
                    <PushPinOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(r)}
                  disabled={
                    r.kind === "global"
                      ? deleteUnitTag.isPending
                      : deleteRealmTagUnit.isPending
                  }
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ];
    return base;
  }, [
    scope,
    deleteUnitTag.isPending,
    deleteRealmTagUnit.isPending,
    patchUnitTag.isPending,
    patchRealmTagUnit.isPending,
  ]);

  return (
    <Page
      title="Low-score tags"
      description="Moderate UnitTag and RealmTagUnit rows whose score has fallen at or below the threshold. Below-threshold rows are hidden from regular users; admins can see and act on them here."
    >
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems="stretch"
          >
            <TextField
              size="small"
              select
              label="Scope"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as LowScoreTagsScope);
                setPage(0);
              }}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="global">Global (UnitTag)</MenuItem>
              <MenuItem value="realm">Realm (RealmTagUnit)</MenuItem>
            </TextField>
            <TextField
              size="small"
              type="number"
              label="Threshold (≤)"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              sx={{ width: 160 }}
            />
            {scope === "realm" ? (
              <TextField
                size="small"
                label="Realm unitId (optional)"
                placeholder="filter to one realm…"
                value={realmInput}
                onChange={(e) => setRealmInput(e.target.value)}
                fullWidth
              />
            ) : null}
            <Button variant="contained" onClick={handleApplyFilters}>
              Apply
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {query.isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={24} />
            </Box>
          ) : query.isError ? (
            <Alert severity="error">
              Failed to load low-score tags: {String(query.error)}
            </Alert>
          ) : rows.length === 0 ? (
            <Alert severity="info">
              No tag rows at or below score {appliedThreshold}.
            </Alert>
          ) : (
            <PaginatedTable<Row>
              columns={columns}
              rows={visibleRows}
              getRowId={(r) =>
                r.kind === "realm"
                  ? `${r.realmUnitId}:${r.unitId}:${r.tagUnitId}`
                  : `${r.unitId}:${r.tagUnitId}`
              }
              count={rows.length}
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
