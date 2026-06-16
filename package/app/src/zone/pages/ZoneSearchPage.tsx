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
 *
 * Layout responsive design:
 * - Mobile (<640px): Full-width search interface, loading/error states centered
 * - Tablet (640-1023px): Max-width 4xl centered content with full-width search
 * - Desktop (1024-1535px): Max-width 4xl content with search controls, filters sidebar (if enabled)
 * - Ultra-wide (≥1536px): Same as desktop with additional horizontal padding
 *
 * Mobile (<640px):
 * ┌─────────────────────────┐
 * │ [Search Bar]            │ (full width input)
 * ├─────────────────────────┤
 * │ [Category Tabs]         │ (scrollable horizontal)
 * │ All | Posts | Wikis...  │
 * ├─────────────────────────┤
 * │ Loading...              │ (centered loading state)
 * │                         │
 * │ (or)                    │
 * │                         │
 * │ [Search Results]        │
 * │ ┌───────────────────┐   │
 * │ │ Result 1          │   │
 * │ │ [Snippet]         │   │
 * │ └───────────────────┘   │
 * │ ┌───────────────────┐   │
 * │ │ Result 2          │   │
 * │ │ [Snippet]         │   │
 * │ └───────────────────┘   │
 * └─────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌───────────────────────────────────┐
 * │ ┌─────────────────────────────┐   │
 * │ │ [Search Bar]                │   │
 * │ └─────────────────────────────┘   │
 * ├───────────────────────────────────┤
 * │ [All] [Posts] [Wikis] [Media]     │ (tabs)
 * ├───────────────────────────────────┤
 * │ ┌─────────────────────────────┐   │
 * │ │ ▲ Result 1                  │   │
 * │ │   [Matching snippet text]   │   │
 * │ └─────────────────────────────┘   │
 * │ ┌─────────────────────────────┐   │
 * │ │ ▲ Result 2                  │   │
 * │ │   [Matching snippet text]   │   │
 * │ └─────────────────────────────┘   │
 * │ ┌─────────────────────────────┐   │
 * │ │ ▲ Result 3                  │   │
 * │ │   [Matching snippet text]   │   │
 * │ └─────────────────────────────┘   │
 * │ [Load More]                       │
 * └───────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────────────┐
 * │ ┌────────────────────────────────────────┐   │
 * │ │ [Search Bar]                           │   │
 * │ └────────────────────────────────────────┘   │
 * ├──────────────────────────────────────────────┤
 * │ [All] [Posts] [Wikis] [Media]                │
 * ├──────────────────────────────────────────────┤
 * │ ┌───────────────────────────────────────┐    │
 * │ │ ▲ Result Item 1                       │    │
 * │ │   [Full matching snippet text here]   │    │
 * │ │   source/category tags                │    │
 * │ └───────────────────────────────────────┘    │
 * │ ┌───────────────────────────────────────┐    │
 * │ │ ▲ Result Item 2                       │    │
 * │ │   [Full matching snippet text here]   │    │
 * │ │   source/category tags                │    │
 * │ └───────────────────────────────────────┘    │
 * │ ┌───────────────────────────────────────┐    │
 * │ │ ▲ Result Item 3                       │    │
 * │ │   [Full matching snippet text here]   │    │
 * │ │   source/category tags                │    │
 * │ └───────────────────────────────────────┘    │
 * │ [Load More...]                               │
 * └──────────────────────────────────────────────┘
 *
 * Ultra-wide (≥1536px):
 * ┌────────────────────────────────────────────────────────┐
 * │ [Padding] ┌──────────────────────────────┐ [Padding]  │
 * │           │ [Search Bar (wide)]          │            │
 * │           └──────────────────────────────┘            │
 * │ [Padding] ┌──────────────────────────────┐ [Padding]  │
 * │           │ [All] [Posts] [Wikis]        │            │
 * │ [Padding] ├──────────────────────────────┤ [Padding]  │
 * │           │ Result Items (expanded)      │            │
 * │           │ [Full-width item 1]          │            │
 * │           │ [Full-width item 2]          │            │
 * │           │ [Full-width item 3]          │            │
 * │           │ [Load More...]               │            │
 * │           └──────────────────────────────┘            │
 * └────────────────────────────────────────────────────────┘
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
      <div className="w-full mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="text-text-secondary">{t("zone:loading")}</p>
      </div>
    );
  }

  if (!zoneUnitId) {
    return (
      <div className="w-full mx-auto max-w-4xl px-4 py-24 text-center">
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
