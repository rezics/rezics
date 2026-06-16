import type {
  Language,
  ZoneDTO,
  ZoneSectionEmptyState,
  ZoneSectionKind,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import type { ReactNode } from "react";
import {
  type ZoneRefUnitMap,
  zoneSectionTitleKey,
  zoneSectionTitleText,
} from "../../models/zoneMenu";

/**
 * Render context threaded through every section renderer: the zone, the
 * batch ref-unit summaries from the portal read, and the viewer language
 * chain for per-section data queries.
 * 贯穿所有分区渲染器的渲染上下文：专区、门户读取返回的批量引用 Unit
 * 摘要，以及用于按分区数据查询的读者语言链。
 */
export type ZonePortalContext = {
  zone: ZoneDTO;
  pageId: string;
  refUnits: ZoneRefUnitMap;
  languages: Language[];
};

/**
 * Section title chain: explicit `titleLabelUnitId` (LABEL unit via
 * refUnits) → kind-default i18n key → no heading. The kind switch keeps
 * every `t()` key a literal for the static i18n checker.
 * 分区标题链：显式 `titleLabelUnitId`（经 refUnits 的 LABEL Unit）→
 * 按 kind 的默认 i18n key → 无标题。kind switch 让每个 `t()` 键保持
 * 字面量，以通过静态 i18n 检查。
 */
export function useZoneSectionTitle(
  section: { kind: ZoneSectionKind; titleLabelUnitId?: string },
  refUnits: ZoneRefUnitMap,
): string | null {
  const { t } = useTranslation(["zone"]);
  const text = zoneSectionTitleText(section, refUnits);
  if (text) return text;
  switch (zoneSectionTitleKey(section.kind)) {
    case "zone:section_title_query":
      return t("zone:section_title_query");
    case "zone:section_title_collection":
      return t("zone:section_title_collection");
    case "zone:section_title_feed":
      return t("zone:section_title_feed");
    case "zone:section_title_richText":
      return t("zone:section_title_richText");
    case "zone:section_title_stats":
      return t("zone:section_title_stats");
    case "zone:section_title_sources":
      return t("zone:section_title_sources");
    default:
      return null;
  }
}

/**
 * Resolves a data label with its zone-page i18n fallback; literal keys for
 * the static i18n checker.
 * 解析数据标签及其专区页面 i18n 回退；为静态 i18n 检查保持字面量键。
 */
export function useZoneLabelResolver() {
  const { t } = useTranslation(["zone"]);
  return (label: string | null, fallbackKey: string | null): string | null => {
    if (label) return label;
    switch (fallbackKey) {
      case "zone:page_home":
        return t("zone:page_home");
      case "zone:page_search":
        return t("zone:page_search");
      case "zone:page_feed":
        return t("zone:page_feed");
      default:
        return null;
    }
  };
}

export function ZoneSectionShell({
  title,
  children,
}: {
  title: string | null;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {title ? (
        <h2 className="text-lg font-semibold leading-ui text-text-primary">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/**
 * `emptyState` defaults to "show-empty"; "hide" drops the whole section
 * (including its heading) when there is nothing to render.
 * `emptyState` 默认为 "show-empty"；"hide" 在无内容时丢弃整个分区
 * （包括标题）。
 */
export function ZoneSectionEmpty({
  title,
  emptyState,
}: {
  title: string | null;
  emptyState: ZoneSectionEmptyState | undefined;
}) {
  const { t } = useTranslation(["zone"]);
  if (emptyState === "hide") return null;
  return (
    <ZoneSectionShell title={title}>
      <EmptyState title={t("zone:section_empty")} />
    </ZoneSectionShell>
  );
}
