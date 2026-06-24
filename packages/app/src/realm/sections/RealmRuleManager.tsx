import {
  realmRuleResolvedQuery,
  useCreateRealmRuleRevisionMutation,
  useUpdateRealmRulePolicyMutation,
} from "@rezics/contract/api/realm/realm";
import { postSearchQueryOptions } from "@rezics/contract/api/meili/meili.queries";
import type {
  PostSearchDocument,
  RealmRuleResolvedItemDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button, Input } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "@/entity-picker";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

type RuleDraftItem = {
  rulePostUnitId: string;
  title: string;
  appliesTo?: string | null;
  reportReasonUnitId?: string | null;
};

function postLabel(post: PostSearchDocument) {
  return (
    post.titleText?.trim() || post.contentText?.trim().slice(0, 80) || post.id
  );
}

function fromResolved(item: RealmRuleResolvedItemDTO): RuleDraftItem {
  return {
    rulePostUnitId: item.rulePostUnitId,
    title:
      item.sourceRulePost?.title?.trim() ||
      item.sourceRulePost?.unitId ||
      item.rulePostUnitId,
    appliesTo: item.appliesTo,
    reportReasonUnitId: item.reportReasonUnitId,
  };
}

/**
 * 设计：rule 管理器是紧凑后台控件。
 * Mobile: requirements、搜索、列表单列堆叠。
 * Tablet: 同单列但按钮同行。
 * Desktop/Ultra-wide: 在父容器宽度内保持可扫描列表。
 */
export function RealmRuleManager({ realmId }: { realmId: string }) {
  const { t } = useTranslation(["common", "community", "entity"]);
  const readContext = useReadLanguageContext();
  const resolvedQuery = useQuery({
    ...realmRuleResolvedQuery(realmId, undefined, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready,
  });
  const updatePolicy = useUpdateRealmRulePolicyMutation();
  const createRevision = useCreateRealmRuleRevisionMutation();
  const [requireOnJoin, setRequireOnJoin] = useState(false);
  const [requireOnPost, setRequireOnPost] = useState(false);
  const [requireOnUpdate, setRequireOnUpdate] = useState(true);
  const [items, setItems] = useState<RuleDraftItem[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 180);
  const postSearch = useQuery({
    ...postSearchQueryOptions({
      keyword: debouncedQuery,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      limit: 8,
    }),
    enabled: readContext.ready && debouncedQuery.length > 0,
  });

  useEffect(() => {
    const policy = resolvedQuery.data?.policy;
    if (!policy) return;
    setRequireOnJoin(policy.requirements.requireOnJoin);
    setRequireOnPost(policy.requirements.requireOnPost);
    setRequireOnUpdate(policy.requirements.requireOnUpdate);
  }, [resolvedQuery.data?.policy]);

  useEffect(() => {
    setItems((resolvedQuery.data?.items ?? []).map(fromResolved));
  }, [resolvedQuery.data?.items]);

  const existingPostIds = useMemo(
    () => new Set(items.map((item) => item.rulePostUnitId)),
    [items],
  );
  const postResults = (postSearch.data?.items ?? []).filter(
    (post) => !existingPostIds.has(post.id),
  );

  const savePolicy = async () => {
    await updatePolicy.mutateAsync({
      realmUnitId: realmId,
      input: { requireOnJoin, requireOnPost, requireOnUpdate },
    });
  };
  const saveRevision = async () => {
    await createRevision.mutateAsync({
      realmUnitId: realmId,
      input: {
        items: items.map((item, index) => ({
          rulePostUnitId: item.rulePostUnitId,
          position: String(index + 1).padStart(4, "0"),
          appliesTo: item.appliesTo ?? null,
          reportReasonUnitId: item.reportReasonUnitId ?? null,
        })),
      },
    });
  };
  const move = (index: number, delta: -1 | 1) => {
    setItems((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });
  };

  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-md bg-surface-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-medium leading-ui text-text-primary">
            {t("entity:realm_rules_title")}
          </h3>
        </div>
        {resolvedQuery.isFetching ? <Spinner size="sm" /> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <RequirementToggle
          label={t("community:realm_rule_require_on_join")}
          checked={requireOnJoin}
          onCheckedChange={setRequireOnJoin}
          onLabel={t("community:realm_rule_toggle_on")}
          offLabel={t("community:realm_rule_toggle_off")}
        />
        <RequirementToggle
          label={t("community:realm_rule_require_on_post")}
          checked={requireOnPost}
          onCheckedChange={setRequireOnPost}
          onLabel={t("community:realm_rule_toggle_on")}
          offLabel={t("community:realm_rule_toggle_off")}
        />
        <RequirementToggle
          label={t("community:realm_rule_require_on_update")}
          checked={requireOnUpdate}
          onCheckedChange={setRequireOnUpdate}
          onLabel={t("community:realm_rule_toggle_on")}
          offLabel={t("community:realm_rule_toggle_off")}
        />
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={savePolicy}
          disabled={updatePolicy.isPending}
        >
          {t("common:save")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-h-0 rounded-sm bg-surface-base p-3">
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
            {items.map((item, index) => (
              <div
                key={item.rulePostUnitId}
                className="flex flex-wrap items-center gap-2 rounded-sm bg-surface-subtle px-2 py-2 text-sm"
              >
                <span className="w-6 shrink-0 text-right tabular-nums text-text-tertiary">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setItems((current) =>
                      current.filter(
                        (candidate) =>
                          candidate.rulePostUnitId !== item.rulePostUnitId,
                      ),
                    )
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              onClick={saveRevision}
              disabled={createRevision.isPending}
            >
              {t("common:save")}
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3 rounded-sm bg-surface-base p-3">
          <div className="relative">
            <Search
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-text-tertiary"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder={t("community:realm_rule_post_search")}
            />
          </div>
          <div className="flex min-h-0 flex-col gap-1">
            {postResults.map((post) => (
              <Button
                key={post.id}
                type="button"
                variant="ghost"
                className="h-auto justify-start gap-2 px-2 py-2 text-left"
                onClick={() => {
                  setItems((current) => [
                    ...current,
                    { rulePostUnitId: post.id, title: postLabel(post) },
                  ]);
                  setQuery("");
                }}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{postLabel(post)}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RequirementToggle({
  label,
  checked,
  onCheckedChange,
  onLabel,
  offLabel,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <Button
      type="button"
      variant={checked ? "default" : "secondary"}
      className="h-auto justify-between gap-3 px-3 py-2"
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 text-xs tabular-nums">
        {checked ? onLabel : offLabel}
      </span>
    </Button>
  );
}
