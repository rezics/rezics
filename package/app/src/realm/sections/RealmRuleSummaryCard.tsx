import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { PostBodyMarkdown } from "@/post";
import { postQueries } from "@rezics/api/post/post";
import { realmRuleResolvedQuery } from "@rezics/api/realm/realm";
import {
  contentDocMarkdownFallback,
  mainMarkdownSource,
  type PostDTO,
  type RealmRuleResolvedDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { Button, Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { RealmRuleDialog } from "./RealmRuleDialog";

interface RealmRuleSummaryCardProps {
  realmUnitId: string;
  fallbackPostUnitId?: string | null;
  empty?: "hidden" | "state";
}

function ruleContent(
  rule?: RealmRuleResolvedDTO | null,
  post?: PostDTO | null,
) {
  return (
    rule?.sourceRulePost?.content ??
    post?.content ??
    rule?.translation?.description ??
    null
  );
}

function rulePreview(
  rule?: RealmRuleResolvedDTO | null,
  post?: PostDTO | null,
) {
  const content = ruleContent(rule, post);
  return (
    mainMarkdownSource(content)?.trim().split("\n").find(Boolean) ??
    rule?.translation?.summary ??
    rule?.translation?.title ??
    contentDocMarkdownFallback(rule?.translation?.description)
      .trim()
      .split("\n")
      .find(Boolean) ??
    ""
  );
}

export function RealmRuleSummaryCard({
  realmUnitId,
  fallbackPostUnitId,
  empty = "hidden",
}: RealmRuleSummaryCardProps) {
  const { t } = useTranslation(["common", "entity"]);
const [open, setOpen] = useState(false);
  const resolvedQuery = useQuery(realmRuleResolvedQuery(realmUnitId));
  const postUnitId =
    resolvedQuery.data?.sourceRulePostUnitId ??
    resolvedQuery.data?.ruleUnitId ??
    fallbackPostUnitId ??
    "";
  const fallbackPostQuery = useQuery({
    ...postQueries.detail(postUnitId),
    enabled:
      Boolean(postUnitId) &&
      !resolvedQuery.data?.sourceRulePost &&
      !resolvedQuery.data?.translation?.description,
  });

  const content = useMemo(
    () => ruleContent(resolvedQuery.data, fallbackPostQuery.data),
    [fallbackPostQuery.data, resolvedQuery.data],
  );
  const preview = useMemo(
    () => rulePreview(resolvedQuery.data, fallbackPostQuery.data),
    [fallbackPostQuery.data, resolvedQuery.data],
  );

  if (resolvedQuery.isLoading || fallbackPostQuery.isLoading) {
    return (
      <div className="flex justify-center rounded-md bg-surface-subtle py-6">
        <Spinner />
      </div>
    );
  }

  if (resolvedQuery.isError) {
    return <QueryErrorDisplay error={resolvedQuery.error} />;
  }

  if (fallbackPostQuery.isError) {
    return <QueryErrorDisplay error={fallbackPostQuery.error} />;
  }

  if (!content) {
    return empty === "state" ? (
      <EmptyState title={t("entity:realm_rules_title")} />
    ) : null;
  }

  return (
    <Card surface="contained">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-text-tertiary" aria-hidden />
              <h2 className="text-sm font-medium leading-ui text-text-primary">
                {t("entity:realm_rules_title")}
              </h2>
            </div>
            {preview ? (
              <p className="mt-2 line-clamp-2 text-sm leading-body text-text-secondary">
                {preview}
              </p>
            ) : (
              <PostBodyMarkdown
                content={content}
                clamp={{ maxLines: 2 }}
                className="mt-2 text-sm leading-body text-text-secondary"
              />
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t("common:view")}
          </Button>
        </div>
        <RealmRuleDialog open={open} content={content} onOpenChange={setOpen} />
      </CardContent>
    </Card>
  );
}
