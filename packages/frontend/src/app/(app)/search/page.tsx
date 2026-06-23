import { SectionBoundary } from "@/components/SectionBoundary";
import { SearchContent } from "./content";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [Search icon] [input     ]  |
 * |-----------------------------|
 * | [All|Books|Realms|Posts|..] |
 * |  ^tabs, overflow-x-auto    |
 * |-----------------------------|
 * | [Result card]               |
 * | [Result card]               |
 * |       [Load more]           |
 * +-----------------------------+
 * w-full, search input full width.
 * Category tabs horizontally scrollable on narrow screens.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [Search icon] [input              ]  |
 * | [All | Books | Realms | Posts | ...] |
 * |--------------------------------------|
 * | [Result card]                        |
 * | [Result card]                        |
 * |           [Load more]               |
 * +--------------------------------------+
 * max-w-3xl mx-auto 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [Search icon] [input                  ]  |
 * | [All | Books | Realms | Posts | Users ]  |
 * |------------------------------------------|
 * | [Result card]                            |
 * | [Result card]                            |
 * |           [Load more]                    |
 * +------------------------------------------+
 * max-w-3xl mx-auto，左侧有侧栏。
 *
 * Ultra-wide (>=1536px):
 * +--------------------------------------------------+
 * |      [Search icon] [input                     ]   |
 * |      [All | Books | Realms | Posts | Users    ]   |
 * |--------------------------------------------------|
 * |      [Result card]                                |
 * |      [Result card]                                |
 * |               [Load more]                         |
 * +--------------------------------------------------+
 * max-w-3xl mx-auto 居中。
 *
 * 全文搜索页面：搜索框 + 类别 tabs + 结果列表。
 * 搜索词通过 nuqs 同步到 URL（?q=...&category=...）。
 * 当前为占位实现，待 Meilisearch 集成后接入实际搜索。
 */
export default function SearchPage() {
  return (
    <SectionBoundary>
      <SearchContent />
    </SectionBoundary>
  );
}
