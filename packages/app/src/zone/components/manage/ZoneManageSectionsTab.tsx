import type {
  CreateZonePageInput,
  UpdateZonePageInput,
  ZoneDTO,
} from "@rezics/contract";
import { positionForNewBottomPin } from "@rezics/contract/api/shared/fractional-index";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Card, CardContent, Input, Label } from "@rezics/ui/shadcn";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ZoneManageDraft } from "../../models/zoneManageDraft";
import { updateZonePageSections } from "../../models/zoneManageDraft";
import {
  type ZoneManageEditorContext,
  ZoneSectionListEditor,
} from "./ZoneSectionListEditor";
import { ZoneManageJsonFrame } from "./ZoneManageJsonFrame";

type ZonePageSummary = ZoneDTO["pages"][number];

function emptyPageConfig(): CreateZonePageInput["config"] {
  return { schema: "rezics/zone-page", version: 1, sections: [] };
}

function pageSort(a: ZonePageSummary, b: ZonePageSummary) {
  return a.position.localeCompare(b.position) || a.slug.localeCompare(b.slug);
}

function nextPageSlug(pages: readonly ZonePageSummary[]): string {
  const taken = new Set(pages.map((page) => page.slug));
  for (let index = 1; ; index += 1) {
    const slug = `page-${index}`;
    if (!taken.has(slug)) return slug;
  }
}

/**
 * Page management for open slug pages. The selected page is the only page
 * config loaded into the draft; metadata operations write the `ZonePage` row,
 * while section edits save that selected page's config envelope.
 */
export function ZoneManageSectionsTab({
  draft,
  onDraftChange,
  ctx,
  pages,
  homePageId,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onUpdatePage,
  onDeletePage,
  onSaveSelectedPage,
  saving,
  saveDisabled,
  onJsonProblemsChange,
}: {
  draft: ZoneManageDraft;
  onDraftChange: (draft: ZoneManageDraft) => void;
  ctx: ZoneManageEditorContext;
  pages: readonly ZonePageSummary[];
  homePageId: string;
  selectedPageId: string | null;
  onSelectPage: (page: ZonePageSummary) => void;
  onCreatePage: (input: CreateZonePageInput) => void;
  onUpdatePage: (pageId: string, input: UpdateZonePageInput) => void;
  onDeletePage: (page: ZonePageSummary) => void;
  onSaveSelectedPage: () => void;
  saving: boolean;
  saveDisabled: boolean;
  onJsonProblemsChange: (key: string, problems: string[]) => void;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const sortedPages = useMemo(() => [...pages].sort(pageSort), [pages]);
  const selectedPage =
    sortedPages.find((page) => page.id === selectedPageId) ??
    sortedPages.find((page) => page.id === homePageId) ??
    sortedPages[0] ??
    null;
  const selectedIndex = selectedPage
    ? sortedPages.findIndex((page) => page.id === selectedPage.id)
    : -1;
  const [newSlug, setNewSlug] = useState(() => nextPageSlug(sortedPages));
  const [slugDraft, setSlugDraft] = useState(selectedPage?.slug ?? "");

  useEffect(() => {
    setSlugDraft(selectedPage?.slug ?? "");
  }, [selectedPage]);

  useEffect(() => {
    setNewSlug((current) =>
      current.trim() && !sortedPages.some((page) => page.slug === current)
        ? current
        : nextPageSlug(sortedPages),
    );
  }, [sortedPages]);

  const selectedSections = selectedPage
    ? (draft.pages[selectedPage.id]?.sections ?? [])
    : [];

  const createPage = () => {
    const slug = newSlug.trim();
    if (!slug) return;
    onCreatePage({
      slug,
      position: positionForNewBottomPin(sortedPages.at(-1)?.position),
      config: emptyPageConfig(),
    });
  };

  const saveMetadata = () => {
    if (!selectedPage) return;
    const slug = slugDraft.trim();
    if (!slug) return;
    onUpdatePage(selectedPage.id, { slug });
  };

  const moveSelected = (direction: "up" | "down") => {
    if (!selectedPage) return;
    const target =
      direction === "up"
        ? sortedPages[selectedIndex - 1]
        : sortedPages[selectedIndex + 1];
    if (!target) return;
    onUpdatePage(selectedPage.id, { position: target.position });
    onUpdatePage(target.id, { position: selectedPage.position });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Card surface="contained">
          <CardContent className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold leading-ui text-text-primary">
                {t("zone:manage_pages")}
              </h3>
            </div>
            <div className="flex flex-col gap-1">
              {sortedPages.map((page, index) => {
                const isSelected = page.id === selectedPage?.id;
                return (
                  <button
                    key={page.id}
                    type="button"
                    className={[
                      "rounded-md px-3 py-2 text-left text-sm leading-ui transition-colors",
                      isSelected
                        ? "bg-surface-base text-text-primary"
                        : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary",
                    ].join(" ")}
                    onClick={() => onSelectPage(page)}
                  >
                    <span className="block truncate font-medium">
                      {page.slug}
                    </span>
                    <span className="block text-xs leading-dense text-text-tertiary">
                      {page.id === homePageId
                        ? t("zone:manage_home_page")
                        : `#${index + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="zone-new-page-slug">
                {t("zone:manage_page_slug")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="zone-new-page-slug"
                  value={newSlug}
                  onChange={(event) => setNewSlug(event.target.value)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={createPage}
                  disabled={saving || !newSlug.trim()}
                  title={t("zone:manage_add_page")}
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0">
        {selectedPage ? (
          <div className="flex flex-col gap-4">
            <Card surface="contained">
              <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="zone-page-slug">
                    {t("zone:manage_page_slug")}
                  </Label>
                  <Input
                    id="zone-page-slug"
                    value={slugDraft}
                    onChange={(event) => setSlugDraft(event.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => moveSelected("up")}
                    disabled={saving || selectedIndex <= 0}
                    title={t("zone:manage_page_move_up")}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => moveSelected("down")}
                    disabled={
                      saving ||
                      selectedIndex < 0 ||
                      selectedIndex >= sortedPages.length - 1
                    }
                    title={t("zone:manage_page_move_down")}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={saveMetadata}
                    disabled={saving || !slugDraft.trim()}
                    title={t("zone:manage_save_page_meta")}
                  >
                    <Save className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onDeletePage(selectedPage)}
                    disabled={saving || selectedPage.id === homePageId}
                    title={t("zone:manage_delete_page")}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <ZoneManageJsonFrame
              draft={draft}
              onDraftChange={onDraftChange}
              target={{ kind: "page", pageId: selectedPage.id }}
              onProblemsChange={onJsonProblemsChange}
            >
              <ZoneSectionListEditor
                sections={selectedSections}
                onChange={(sections) =>
                  onDraftChange({
                    ...draft,
                    pages: updateZonePageSections(
                      draft.pages,
                      selectedPage.id,
                      () => sections,
                    ),
                  })
                }
                slot="page"
                ctx={ctx}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={onSaveSelectedPage}
                  disabled={saving || saveDisabled}
                >
                  {t("zone:manage_save_page")}
                </Button>
              </div>
            </ZoneManageJsonFrame>
          </div>
        ) : null}
      </div>
    </div>
  );
}
