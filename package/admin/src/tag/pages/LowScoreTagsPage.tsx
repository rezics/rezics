import {
  positionForNewBottomPin,
  positionForNewTopPin,
} from "@rezics/api/tag/fractional-index";
import {
  useDeleteRealmTagUnitMutation,
  usePatchRealmTagUnitMutation,
} from "@rezics/api/realm/realm.mutations";
import {
  useDeleteUnitTagMutation,
  usePatchUnitTagMutation,
} from "@rezics/api/tag/tag.mutations";
import { lowScoreTagsQuery } from "@rezics/api/tag/tag.queries";
import type {
  LowScoreTagsScope,
  RealmTagUnitDTO,
  UnitTagDTO,
} from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Pin, Trash2 } from "lucide-react";
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

  const handleDelete = React.useCallback(
    (row: Row) => {
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
    },
    [deleteUnitTag, deleteRealmTagUnit],
  );

  const handleTogglePin = React.useCallback(
    (row: Row) => {
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
    },
    [patchUnitTag, patchRealmTagUnit],
  );

  const columns = React.useMemo<PaginatedColumn<Row>[]>(() => {
    const base: PaginatedColumn<Row>[] = [
      {
        id: "scope",
        header: "Scope",
        minWidth: 90,
        cell: (r) => <span className="text-xs font-mono">{r.kind}</span>,
      },
      ...(scope === "realm"
        ? [
            {
              id: "realm",
              header: "Realm",
              minWidth: 220,
              cell: (r: Row) =>
                r.kind === "realm" ? (
                  <span className="text-sm font-mono">{r.realmUnitId}</span>
                ) : null,
            },
          ]
        : []),
      {
        id: "unit",
        header: "Unit",
        minWidth: 220,
        cell: (r) => <span className="text-sm font-mono">{r.unitId}</span>,
      },
      {
        id: "tag",
        header: "Tag",
        minWidth: 220,
        cell: (r) => <span className="text-sm font-mono">{r.tagUnitId}</span>,
      },
      {
        id: "score",
        header: "Score",
        minWidth: 90,
        cell: (r) => (
          <span className="text-sm font-mono font-semibold text-error-text">
            {r.score}
          </span>
        ),
      },
      {
        id: "voteCount",
        header: "Votes",
        minWidth: 80,
        cell: (r) => <span className="text-sm font-mono">{r.voteCount}</span>,
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
          <TooltipProvider>
            <div className="flex flex-row gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => handleTogglePin(r)}
                      disabled={
                        r.kind === "global"
                          ? patchUnitTag.isPending
                          : patchRealmTagUnit.isPending
                      }
                      aria-label={r.pinned ? "Unpin" : "Pin"}
                      {...props}
                    >
                      {r.pinned ? (
                        <Pin size={18} fill="currentColor" />
                      ) : (
                        <Pin size={18} />
                      )}
                    </Button>
                  )}
                />
                <TooltipContent>{r.pinned ? "Unpin" : "Pin"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-error-text"
                      onClick={() => handleDelete(r)}
                      disabled={
                        r.kind === "global"
                          ? deleteUnitTag.isPending
                          : deleteRealmTagUnit.isPending
                      }
                      aria-label="Delete"
                      {...props}
                    >
                      <Trash2 size={18} />
                    </Button>
                  )}
                />
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        ),
      },
    ];
    return base;
  }, [
    scope,
    handleDelete,
    handleTogglePin,
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
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label className="text-xs">Scope</Label>
              <Select
                value={scope}
                onValueChange={(v) => {
                  setScope(v as LowScoreTagsScope);
                  setPage(0);
                }}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (UnitTag)</SelectItem>
                  <SelectItem value="realm">Realm (RealmTagUnit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 w-40">
              <Label htmlFor="lst-threshold" className="text-xs">
                Threshold (≤)
              </Label>
              <Input
                id="lst-threshold"
                type="number"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="h-8"
              />
            </div>
            {scope === "realm" ? (
              <div className="flex-1 flex flex-col gap-1">
                <Label htmlFor="lst-realm" className="text-xs">
                  Realm unitId (optional)
                </Label>
                <Input
                  id="lst-realm"
                  placeholder="filter to one realm…"
                  value={realmInput}
                  onChange={(e) => setRealmInput(e.target.value)}
                  className="h-8"
                />
              </div>
            ) : null}
            <div className="flex items-end">
              <Button onClick={handleApplyFilters}>Apply</Button>
            </div>
          </div>

          <Separator className="my-4" />

          {query.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : query.isError ? (
            <Alert>
              <AlertDescription className="text-error-text">
                Failed to load low-score tags: {String(query.error)}
              </AlertDescription>
            </Alert>
          ) : rows.length === 0 ? (
            <Alert>
              <AlertDescription className="text-info-text">
                No tag rows at or below score {appliedThreshold}.
              </AlertDescription>
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
