import { realmRuleResolvedQuery } from "@rezics/contract/api/realm/realm.queries";
import {
  mainMarkdownSource,
  type RealmRuleResolvedItemDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { Button, Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { QueryErrorDisplay } from "@/core";
import { PostBodyMarkdown } from "@/post";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

interface RealmRuleSummaryCardProps {
  realmUnitId: string;
  empty?: "hidden" | "state";
}

/**
 * 设计：规则卡片对标 reddit 侧栏规则，逐条折叠。
 * Mobile: 标题行 + 单列规则按钮，展开内容在当前行下方。
 * Tablet/Desktop/Ultra-wide: 同结构，宽度继承父容器；按钮图标固定，文本截断。
 */
export function RealmRuleSummaryCard({
  realmUnitId,
  empty = "hidden",
}: RealmRuleSummaryCardProps) {
  const { t } = useTranslation(["common", "entity"]);
  const readContext = useReadLanguageContext();
  const [openIds, setOpenIds] = useState(() => new Set<string>());
  const resolvedQuery = useQuery({
    ...realmRuleResolvedQuery(realmUnitId, undefined, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready,
  });
  const items = resolvedQuery.data?.items ?? [];

  const numberedItems = useMemo(
    () => items.map((item, index) => ({ item, index: index + 1 })),
    [items],
  );

  if (resolvedQuery.isLoading) {
    return (
      <div className="flex justify-center rounded-md bg-surface-subtle py-6">
        <Spinner />
      </div>
    );
  }

  if (resolvedQuery.isError) {
    return <QueryErrorDisplay error={resolvedQuery.error} />;
  }

  if (items.length === 0) {
    return empty === "state" ? (
      <EmptyState title={t("entity:realm_rules_title")} />
    ) : null;
  }

  const toggle = (id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card surface="contained">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-text-tertiary" aria-hidden />
          <h2 className="text-sm font-medium leading-ui text-text-primary">
            {t("entity:realm_rules_title")}
          </h2>
        </div>
        <div className="divide-y divide-border-subtle">
          {numberedItems.map(({ item, index }) => {
            const open = openIds.has(item.id);
            const preview = rulePreview(item);
            return (
              <div key={item.id} className="py-2 first:pt-0 last:pb-0">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 px-0 py-1 text-left"
                  onClick={() => toggle(item.id)}
                >
                  {open ? (
                    <ChevronDown
                      className="size-4 shrink-0 text-text-tertiary"
                      aria-hidden
                    />
                  ) : (
                    <ChevronRight
                      className="size-4 shrink-0 text-text-tertiary"
                      aria-hidden
                    />
                  )}
                  <span className="w-6 shrink-0 text-right text-sm tabular-nums text-text-tertiary">
                    {index}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium leading-ui text-text-primary">
                    {preview || item.rulePostUnitId}
                  </span>
                </Button>
                {open ? (
                  <div className="mt-2 pl-12 text-sm leading-body text-text-secondary">
                    <PostBodyMarkdown
                      content={item.sourceRulePost?.content}
                      clamp={false}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function rulePreview(item: RealmRuleResolvedItemDTO) {
  return (
    mainMarkdownSource(item.sourceRulePost?.content)
      ?.trim()
      .split("\n")
      .find(Boolean) ?? ""
  );
}
