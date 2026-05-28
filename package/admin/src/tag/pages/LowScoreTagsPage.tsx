import { getI18nRuntime } from "@rezics/i18n/runtime";
import {
  useDeleteRealmTagApplicationMutation,
  usePatchRealmTagApplicationMutation,
} from "@rezics/api/realm/realm.mutations";
import {
  positionForNewBottomPin,
  positionForNewTopPin,
} from "@rezics/api/tag/fractional-index";
import {
  useDeleteUnitTagMutation,
  usePatchUnitTagMutation,
} from "@rezics/api/tag/tag.mutations";
import { lowScoreTagsQuery } from "@rezics/api/tag/tag.queries";
import type {
  LowScoreTagsScope,
  RealmTagApplicationDTO,
  UnitTagDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
  | ({ kind: "realm" } & RealmTagApplicationDTO);

export default function LowScoreTagsPage() {
  const { t } = useTranslation(["admin", "common"]);
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
  const deleteRealmTagApplication = useDeleteRealmTagApplicationMutation();
  const patchRealmTagApplication = usePatchRealmTagApplicationMutation();

  const rows: Row[] = React.useMemo(() => {
    const data = query.data;
    if (!data) return [];
    if (data.scope === "global" && data.unitTags) {
      return data.unitTags.map((r) => ({ kind: "global" as const, ...r }));
    }
    if (data.scope === "realm" && data.realmTagApplications) {
      return data.realmTagApplications.map((r) => ({
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
        deleteRealmTagApplication.mutate({
          realmUnitId: row.realmUnitId,
          unitId: row.unitId,
          tagUnitId: row.tagUnitId,
        });
      }
    },
    [deleteUnitTag, deleteRealmTagApplication],
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
          patchRealmTagApplication.mutate({
            realmUnitId: row.realmUnitId,
            unitId: row.unitId,
            tagUnitId: row.tagUnitId,
            input: { pinned: false, position: null },
          });
        } else {
          patchRealmTagApplication.mutate({
            realmUnitId: row.realmUnitId,
            unitId: row.unitId,
            tagUnitId: row.tagUnitId,
            input: { pinned: true, position: positionForNewTopPin() },
          });
        }
      }
    },
    [patchUnitTag, patchRealmTagApplication],
  );

  const columns = React.useMemo<PaginatedColumn<Row>[]>(() => {
    const base: PaginatedColumn<Row>[] = [
      {
        id: "scope",
        header: t("common:scope"),
        minWidth: 90,
        cell: (r) => <span className="text-xs font-mono">{r.kind}</span>,
      },
      ...(scope === "realm"
        ? [
            {
              id: "realm",
              header: t("common:realm"),
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
        header: t("common:unit"),
        minWidth: 220,
        cell: (r) => <span className="text-sm font-mono">{r.unitId}</span>,
      },
      {
        id: "tag",
        header: t("common:tag"),
        minWidth: 220,
        cell: (r) => <span className="text-sm font-mono">{r.tagUnitId}</span>,
      },
      {
        id: "score",
        header: t("common:score"),
        minWidth: 90,
        cell: (r) => (
          <span className="text-sm font-mono font-semibold text-error-text">
            {r.score}
          </span>
        ),
      },
      {
        id: "voteCount",
        header: t("common:votes"),
        minWidth: 80,
        cell: (r) => <span className="text-sm font-mono">{r.voteCount}</span>,
      },
      {
        id: "pinned",
        header: t("common:pinned"),
        minWidth: 80,
        cell: (r) => (r.pinned ? t("common:yes") : "-"),
      },
      {
        id: "actions",
        header: t("common:actions"),
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
                          : patchRealmTagApplication.isPending
                      }
                      aria-label={
                        r.pinned ? t("admin:tag_unpin") : t("admin:tag_pin")
                      }
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
                <TooltipContent>
                  {r.pinned ? t("admin:tag_unpin") : t("admin:tag_pin")}
                </TooltipContent>
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
                          : deleteRealmTagApplication.isPending
                      }
                      aria-label={t("common:delete")}
                      {...props}
                    >
                      <Trash2 size={18} />
                    </Button>
                  )}
                />
                <TooltipContent>{t("common:delete")}</TooltipContent>
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
    deleteRealmTagApplication.isPending,
    patchUnitTag.isPending,
    patchRealmTagApplication.isPending,
    getI18nRuntime().i18n.t("admin:tag_pin"),
    getI18nRuntime().i18n.t("admin:tag_unpin"),
    getI18nRuntime().i18n.t("common:actions"),
    getI18nRuntime().i18n.t("common:delete"),
    getI18nRuntime().i18n.t("common:pinned"),
    getI18nRuntime().i18n.t("common:realm"),
    getI18nRuntime().i18n.t("common:scope"),
    getI18nRuntime().i18n.t("common:score"),
    getI18nRuntime().i18n.t("common:tag"),
    getI18nRuntime().i18n.t("common:unit"),
    getI18nRuntime().i18n.t("common:votes"),
    getI18nRuntime().i18n.t("common:yes"),
  ]);

  return (
    <Page
      title={t("admin:tag_low_score_title")}
      description={t("admin:tag_low_score_description")}
    >
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label className="text-xs">{t("common:scope")}</Label>
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
                  <SelectItem value="global">
                    {t("admin:tag_scope_global")}
                  </SelectItem>
                  <SelectItem value="realm">
                    {t("admin:tag_scope_realm")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 w-40">
              <Label htmlFor="lst-threshold" className="text-xs">
                {t("admin:tag_threshold_label")}
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
                  {t("admin:tag_realm_filter_label")}
                </Label>
                <Input
                  id="lst-realm"
                  placeholder={t("admin:tag_realm_filter_placeholder")}
                  value={realmInput}
                  onChange={(e) => setRealmInput(e.target.value)}
                  className="h-8"
                />
              </div>
            ) : null}
            <div className="flex items-end">
              <Button onClick={handleApplyFilters}>{t("common:apply")}</Button>
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
                {t("admin:tag_low_score_failed_load", {
                  error: String(query.error),
                })}
              </AlertDescription>
            </Alert>
          ) : rows.length === 0 ? (
            <Alert>
              <AlertDescription className="text-info-text">
                {t("admin:tag_low_score_empty", {
                  threshold: appliedThreshold,
                })}
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
