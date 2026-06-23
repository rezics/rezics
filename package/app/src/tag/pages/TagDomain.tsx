import { tagQueries } from "@rezics/api/tag/tag";
import { useTranslation } from "@rezics/i18n/react";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { QueryBoundary } from "@/core/components/QueryBoundary";
import { Route as tagDomainRoute } from "@/routes/_mainLayout/tag/domain/$unitId/route";
import { Route as tagDomainTitleRoute } from "@/routes/_mainLayout/tag/domain/$unitId/title/$title";
import { TagWrapper } from "../components/TagWrapper";

export function TagDomainPage() {
  const { t } = useTranslation(["common", "community"]);
  // Keep both route shapes available while the tag routes are being migrated.
  // 在标签路由迁移期间，同时保留两种路由形态。
  const withTitleMatch = tagDomainTitleRoute.useMatch({ shouldThrow: true });
  const baseMatch = tagDomainRoute.useMatch({ shouldThrow: true });
  const unitId =
    withTitleMatch?.params.unitId ?? baseMatch?.params.unitId ?? "";
  const title = withTitleMatch?.params.title;
  const query = useQuery(tagQueries.list({ unitId }));

  return (
    <div className="w-full px-4 mt-16">
      <AccentBarWithText
        text={title ?? t("community:tag_domain_title", { id: unitId })}
      />
      <QueryBoundary query={query}>
        {() => <TagWrapper filters={{ unitId }} mode="flat" />}
      </QueryBoundary>
    </div>
  );
}
