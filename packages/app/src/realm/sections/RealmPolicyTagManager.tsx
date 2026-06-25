import {
  generateKeyBetween,
  positionForNewBottomPin,
} from "@rezics/contract/shared/fractional-index";
import {
  policyTagApplicationListQuery,
  policyTagRuleListQuery,
} from "@rezics/contract/api/policy-tag/policy-tag.queries";
import {
  useCreatePolicyTagRuleMutation,
  useDeletePolicyTagApplicationMutation,
  usePatchPolicyTagApplicationMutation,
  useUpdatePolicyTagRuleMutation,
  useUpsertPolicyTagApplicationMutation,
} from "@rezics/contract/api/policy-tag/policy-tag.mutations";
import {
  contentSearchQueryOptions,
  meiliTagSearchQueryOptions,
} from "@rezics/contract/api/meili/meili.queries";
import type {
  ContentSearchDocument,
  PolicyTagApplicationDTO,
  PolicyTagRuleDTO,
  PolicyTagScope,
  TagSearchDocument,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/entity-picker";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { cn } from "@/shared/utils/css-util";

function tagLabel(tag: TagSearchDocument): string {
  return tag.title ?? tag.slug ?? tag.id;
}

function unitLabel(unit: ContentSearchDocument): string {
  return unit.title ?? unit.titles[0] ?? unit.id;
}

/**
 * Realm policy tag manager.
 *
 * 移动端单列堆叠 rule 与 application；平板仍单列但列表更舒展；桌面起
 * rule 列与 application 列并排；超宽保持居中的两列最大宽度，不拉出失控
 * 行宽。所有列表有固定滚动区域，搜索弹窗按内容滚动。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Header + create rule      │
 * │ Rule list                 │
 * │ Application list          │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Header actions                      │
 * │ Full-width rule list                │
 * │ Full-width application list         │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Rules column       │ Applications column   │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Same two columns within parent max width   │
 * └────────────────────────────────────────────┘
 */
export function RealmPolicyTagManager({ realmId }: { realmId: string }) {
  return <PolicyTagManager scope={{ kind: "realm", realmUnitId: realmId }} />;
}

export function GlobalPolicyTagManager() {
  return <PolicyTagManager scope={{ kind: "global" }} />;
}

function PolicyTagManager({ scope }: { scope: PolicyTagScope }) {
  const { t } = useTranslation(["common", "community"]);
  const title =
    scope.kind === "global"
      ? t("community:policy_tag_global_manager_title")
      : t("community:policy_tag_manager_title");
  const description =
    scope.kind === "global"
      ? t("community:policy_tag_global_manager_description")
      : t("community:policy_tag_manager_description");
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [ruleReason, setRuleReason] = useState("");
  const [ruleLabels, setRuleLabels] = useState(() => new Map<string, string>());
  const [unitLabels, setUnitLabels] = useState(() => new Map<string, string>());

  const rulesQuery = useQuery(
    policyTagRuleListQuery({
      scopeKind: scope.kind,
      ...(scope.kind === "realm" ? { realmUnitId: scope.realmUnitId } : {}),
      limit: 100,
    }),
  );
  const rules = rulesQuery.data?.rules ?? [];
  const activeRules = rules.filter((rule) => rule.state === "active");
  const selectedRule =
    rules.find((rule) => rule.id === selectedRuleId) ?? activeRules[0] ?? null;

  const applicationsQuery = useQuery({
    ...policyTagApplicationListQuery({
      ruleId: selectedRule?.id ?? "",
      limit: 100,
    }),
    enabled: Boolean(selectedRule),
  });
  const applications = applicationsQuery.data?.applications ?? [];
  const createRule = useCreatePolicyTagRuleMutation();

  const handleCreateRule = async (tag: TagSearchDocument) => {
    const rule = await createRule.mutateAsync({
      scope,
      tagUnitId: tag.id,
      reason: ruleReason.trim() || null,
    });
    setRuleLabels((current) => new Map(current).set(tag.id, tagLabel(tag)));
    setSelectedRuleId(rule.id);
    setRuleReason("");
    setTagPickerOpen(false);
  };

  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-md bg-surface-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-medium leading-ui text-text-primary">
            {title}
          </h3>
          <p className="m-0 mt-1 text-sm leading-body text-text-secondary">
            {description}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setTagPickerOpen(true)}
          disabled={createRule.isPending}
        >
          <Plus className="size-4" aria-hidden />
          {t("community:policy_tag_rule_create")}
        </Button>
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-h-0 rounded-sm bg-surface-base p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="m-0 text-sm font-medium leading-ui text-text-primary">
              {t("community:policy_tag_rules")}
            </h4>
            {rulesQuery.isFetching ? <Spinner size="sm" /> : null}
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {rules.length === 0 ? (
              <p className="m-0 text-sm leading-body text-text-secondary">
                {t("community:policy_tag_rule_empty")}
              </p>
            ) : (
              rules.map((rule) => (
                <PolicyTagRuleRow
                  key={rule.id}
                  rule={rule}
                  label={ruleLabels.get(rule.tagUnitId)}
                  selected={selectedRule?.id === rule.id}
                  onSelect={() => setSelectedRuleId(rule.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="min-h-0 rounded-sm bg-surface-base p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className="m-0 text-sm font-medium leading-ui text-text-primary">
                {t("community:policy_tag_applications")}
              </h4>
              <p className="m-0 truncate text-xs leading-dense text-text-tertiary">
                {selectedRule
                  ? (ruleLabels.get(selectedRule.tagUnitId) ??
                    selectedRule.tagUnitId)
                  : t("community:policy_tag_rule_select")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {applicationsQuery.isFetching ? <Spinner size="sm" /> : null}
              {selectedRule ? <ArchiveRuleButton rule={selectedRule} /> : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setUnitPickerOpen(true)}
                disabled={!selectedRule}
              >
                <Plus className="size-4" aria-hidden />
                {t("community:policy_tag_application_add")}
              </Button>
            </div>
          </div>

          {selectedRule ? (
            <PolicyTagApplicationList
              rule={selectedRule}
              applications={applications}
              labels={unitLabels}
              onLabel={(unitId, label) =>
                setUnitLabels((current) => new Map(current).set(unitId, label))
              }
            />
          ) : (
            <p className="m-0 text-sm leading-body text-text-secondary">
              {t("community:policy_tag_rule_select")}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="policy-tag-rule-reason" className="text-sm">
          {t("community:policy_tag_rule_reason")}
        </Label>
        <Textarea
          id="policy-tag-rule-reason"
          value={ruleReason}
          onChange={(event) => setRuleReason(event.target.value)}
          placeholder={t("community:policy_tag_rule_reason_placeholder")}
          className="min-h-20"
        />
      </div>

      <TagSearchDialog
        open={tagPickerOpen}
        onOpenChange={setTagPickerOpen}
        onPick={handleCreateRule}
      />
      {selectedRule ? (
        <UnitSearchDialog
          open={unitPickerOpen}
          onOpenChange={setUnitPickerOpen}
          rule={selectedRule}
          applications={applications}
          onLabel={(unitId, label) =>
            setUnitLabels((current) => new Map(current).set(unitId, label))
          }
        />
      ) : null}
    </section>
  );
}

function PolicyTagRuleRow({
  rule,
  label,
  selected,
  onSelect,
}: {
  rule: PolicyTagRuleDTO;
  label?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation(["community"]);
  return (
    <button
      type="button"
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm leading-ui hover:bg-surface-subtle",
        selected ? "bg-surface-subtle text-text-primary" : "text-text-primary",
      )}
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label ?? rule.tagUnitId}</span>
        <span className="block truncate font-mono text-xs text-text-tertiary">
          {rule.tagUnitId}
        </span>
      </span>
      <Badge variant={rule.state === "active" ? "default" : "secondary"}>
        {rule.state === "active"
          ? t("community:policy_tag_state_active")
          : t("community:policy_tag_state_archived")}
      </Badge>
    </button>
  );
}

function ArchiveRuleButton({ rule }: { rule: PolicyTagRuleDTO }) {
  const { t } = useTranslation(["community"]);
  const updateRule = useUpdatePolicyTagRuleMutation(rule.id);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={rule.state === "archived" || updateRule.isPending}
      onClick={() => updateRule.mutate({ state: "archived" })}
    >
      <Archive className="size-4" aria-hidden />
      {t("community:policy_tag_rule_archive")}
    </Button>
  );
}

function PolicyTagApplicationList({
  rule,
  applications,
  labels,
  onLabel,
}: {
  rule: PolicyTagRuleDTO;
  applications: PolicyTagApplicationDTO[];
  labels: Map<string, string>;
  onLabel: (unitId: string, label: string) => void;
}) {
  const { t } = useTranslation(["community"]);
  if (applications.length === 0) {
    return (
      <p className="m-0 text-sm leading-body text-text-secondary">
        {t("community:policy_tag_application_empty")}
      </p>
    );
  }
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {applications.map((application, index) => (
        <PolicyTagApplicationRow
          key={application.id}
          rule={rule}
          application={application}
          label={labels.get(application.unitId)}
          previous={applications[index - 1]}
          next={applications[index + 1]}
          beforePrevious={applications[index - 2]}
          afterNext={applications[index + 2]}
          onLabel={onLabel}
        />
      ))}
    </div>
  );
}

function PolicyTagApplicationRow({
  rule,
  application,
  label,
  previous,
  next,
  beforePrevious,
  afterNext,
}: {
  rule: PolicyTagRuleDTO;
  application: PolicyTagApplicationDTO;
  label?: string;
  previous?: PolicyTagApplicationDTO;
  next?: PolicyTagApplicationDTO;
  beforePrevious?: PolicyTagApplicationDTO;
  afterNext?: PolicyTagApplicationDTO;
  onLabel: (unitId: string, label: string) => void;
}) {
  const { t } = useTranslation(["community", "common"]);
  const patch = usePatchPolicyTagApplicationMutation({
    ruleId: rule.id,
    unitId: application.unitId,
  });
  const remove = useDeletePolicyTagApplicationMutation({
    ruleId: rule.id,
    unitId: application.unitId,
  });
  const moveUp = () => {
    const position = generateKeyBetween(
      beforePrevious?.position ?? undefined,
      previous?.position ?? undefined,
    );
    patch.mutate({ position });
  };
  const moveDown = () => {
    const position = generateKeyBetween(
      next?.position ?? undefined,
      afterNext?.position ?? undefined,
    );
    patch.mutate({ position });
  };
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-sm border border-border-whisper bg-surface-subtle p-2">
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm leading-ui text-text-primary">
          {label ?? application.unitId}
        </p>
        <p className="m-0 truncate font-mono text-xs leading-dense text-text-tertiary">
          {application.unitId}
        </p>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={!previous || patch.isPending}
        aria-label={t("community:policy_tag_application_move_up")}
        onClick={moveUp}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={!next || patch.isPending}
        aria-label={t("community:policy_tag_application_move_down")}
        onClick={moveDown}
      >
        <ArrowDown className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={remove.isPending}
        aria-label={t("common:delete")}
        onClick={() => remove.mutate()}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function TagSearchDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (tag: TagSearchDocument) => void;
}) {
  const { t } = useTranslation(["community"]);
  const readContext = useReadLanguageContext();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const searchQuery = useQuery({
    ...meiliTagSearchQueryOptions({
      keyword: debouncedQuery,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      limit: 12,
    }),
    enabled: open && readContext.ready && debouncedQuery.length > 0,
  });
  const results = searchQuery.data?.items ?? [];
  return (
    <PickerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("community:policy_tag_pick_tag")}
      query={query}
      onQueryChange={setQuery}
      placeholder={t("community:policy_tag_pick_tag_search")}
      loading={searchQuery.isFetching}
    >
      {results.map((result) => (
        <PickerRow
          key={result.id}
          label={tagLabel(result)}
          meta={result.id}
          onClick={() => onPick(result)}
        />
      ))}
    </PickerDialog>
  );
}

function UnitSearchDialog({
  open,
  onOpenChange,
  rule,
  applications,
  onLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: PolicyTagRuleDTO;
  applications: PolicyTagApplicationDTO[];
  onLabel: (unitId: string, label: string) => void;
}) {
  const { t } = useTranslation(["community"]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const applied = useMemo(
    () => new Set(applications.map((application) => application.unitId)),
    [applications],
  );
  const searchQuery = useQuery({
    ...contentSearchQueryOptions({ keyword: debouncedQuery, limit: 12 }),
    enabled: open && debouncedQuery.length > 0,
  });
  const results = (searchQuery.data?.items ?? []).filter(
    (result) => !applied.has(result.id),
  );
  const upsert = useUpsertPolicyTagApplicationMutation(rule.id);
  const addUnit = async (unit: ContentSearchDocument) => {
    const lastPosition = applications.at(-1)?.position ?? null;
    await upsert.mutateAsync({
      unitId: unit.id,
      position: positionForNewBottomPin(lastPosition),
    });
    onLabel(unit.id, unitLabel(unit));
    setQuery("");
    onOpenChange(false);
  };
  return (
    <PickerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("community:policy_tag_pick_unit")}
      query={query}
      onQueryChange={setQuery}
      placeholder={t("community:policy_tag_pick_unit_search")}
      loading={searchQuery.isFetching || upsert.isPending}
    >
      {results.map((result) => (
        <PickerRow
          key={result.id}
          label={unitLabel(result)}
          meta={result.type}
          onClick={() => addUnit(result)}
        />
      ))}
    </PickerDialog>
  );
}

function PickerDialog({
  open,
  onOpenChange,
  title,
  query,
  onQueryChange,
  placeholder,
  loading,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onQueryChange("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[min(90dvh,620px)] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border-whisper p-4">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="shrink-0 p-3">
          <div className="flex items-center gap-2">
            <Search
              className="size-4 shrink-0 text-text-tertiary"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : null}
          <div className="space-y-1">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PickerRow({
  label,
  meta,
  onClick,
}: {
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm leading-ui text-text-primary hover:bg-surface-subtle"
      onClick={onClick}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 truncate font-mono text-xs text-text-tertiary">
        {meta}
      </span>
    </button>
  );
}
