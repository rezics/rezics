import type { ZonePageId } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { ZoneManageDraft } from "../../models/zoneManageDraft";
import {
  addZonePage,
  removeZonePage,
  updateZonePageSections,
  ZONE_PAGE_IDS,
} from "../../models/zoneManageDraft";
import {
  type ZoneManageEditorContext,
  ZoneSectionListEditor,
} from "./ZoneSectionListEditor";

const PAGE_LABEL_KEYS = {
  home: "zone:page_home",
  search: "zone:page_search",
  feed: "zone:page_feed",
} as const satisfies Record<ZonePageId, `zone:${string}`>;

/**
 * Pages & Sections tab: one inner tab per configured page (home required;
 * search/feed addable/removable), each hosting a top-level section list
 * (slot="page").
 * 页面与分区标签页：每个已配置页面一个内部标签（home 必有；search/feed
 * 可增删），各承载一个顶层分区列表（slot="page"）。
 */
export function ZoneManageSectionsTab({
  draft,
  onDraftChange,
  ctx,
}: {
  draft: ZoneManageDraft;
  onDraftChange: (draft: ZoneManageDraft) => void;
  ctx: ZoneManageEditorContext;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const configuredPages = ZONE_PAGE_IDS.filter((pageId) => draft.pages[pageId]);
  const missingPages = ZONE_PAGE_IDS.filter((pageId) => !draft.pages[pageId]);
  const [activePage, setActivePage] = useState<ZonePageId>("home");
  const currentPage = draft.pages[activePage] ? activePage : "home";

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={currentPage}
        onValueChange={(pageId) => setActivePage(pageId as ZonePageId)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {configuredPages.map((pageId) => (
              <TabsTrigger key={pageId} value={pageId}>
                {t(PAGE_LABEL_KEYS[pageId])}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-2">
            {missingPages.map((pageId) => (
              <Button
                key={pageId}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onDraftChange({
                    ...draft,
                    pages: addZonePage(draft.pages, pageId),
                  });
                  setActivePage(pageId);
                }}
              >
                <Plus className="mr-1 size-4" aria-hidden />
                {t(PAGE_LABEL_KEYS[pageId])}
              </Button>
            ))}
            {currentPage !== "home" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onDraftChange({
                    ...draft,
                    pages: removeZonePage(draft.pages, currentPage),
                  });
                  setActivePage("home");
                }}
              >
                <X className="mr-1 size-4" aria-hidden />
                {t("zone:manage_remove_page")}
              </Button>
            ) : null}
          </div>
        </div>

        {configuredPages.map((pageId) => (
          <TabsContent key={pageId} value={pageId} className="mt-4">
            <ZoneSectionListEditor
              sections={draft.pages[pageId]?.sections ?? []}
              onChange={(sections) =>
                onDraftChange({
                  ...draft,
                  pages: updateZonePageSections(
                    draft.pages,
                    pageId,
                    () => sections,
                  ),
                })
              }
              slot="page"
              ctx={ctx}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
