import { zoneQueryOptions } from "@rezics/api";
import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { FederatedSearchPage } from "@/search";

type ZoneSearchPageBaseProps = {
  initialQuery?: SearchQuery;
  initialCategory?: SearchCategory;
  onCategoryChange: (next: SearchCategory) => void;
};

type ZoneSearchPageProps = ZoneSearchPageBaseProps &
  (
    | {
        slug: string;
        unitId?: never;
      }
    | {
        slug?: never;
        unitId: string;
      }
  );

/**
 * The server compiles the zone boundary (`config.filters`) into the
 * federated zone scope, so no client-side filter merging happens here —
 * the page only resolves the zone unitId and hands off to federated
 * search.
 * 服务端将专区边界（`config.filters`）编译进联合搜索的专区 scope，
 * 因此这里不做任何客户端过滤合并——页面只解析专区 unitId 并交给联合
 * 搜索。
 */
export const ZoneSearchPage: React.FC<ZoneSearchPageProps> = ({
  slug,
  unitId,
  initialQuery,
  initialCategory,
  onCategoryChange,
}) => {
  const { t } = useTranslation(["zone"]);
  const slugQuery = useQuery({
    ...zoneQueryOptions(slug ?? ""),
    enabled: !unitId && !!slug,
  });
  const zoneUnitId = unitId ?? slugQuery.data?.unitId;

  if (!unitId && slugQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="text-text-secondary">{t("zone:loading")}</p>
      </div>
    );
  }

  if (!zoneUnitId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h2 className="text-2xl font-semibold leading-ui text-text-primary">
          {t("zone:not_found")}
        </h2>
      </div>
    );
  }

  return (
    <FederatedSearchPage
      scope={{ kind: "zone", zoneUnitId }}
      initialQuery={initialQuery}
      initialCategory={initialCategory}
      onCategoryChange={onCategoryChange}
    />
  );
};
