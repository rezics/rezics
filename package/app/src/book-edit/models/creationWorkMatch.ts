import type { ContentSearchDocument, CreationMode } from "@rezics/contract";
import { CreationMode as CreationModeValue } from "@rezics/contract";

export type CreationWorkMatchCopy = {
  title: string;
  description: string;
  prominent: boolean;
};

export type CreationWorkMatchContext = {
  releaseUnitId: string;
  title: string;
  targetUnitId: string;
  isVariant: boolean;
  relatedReleaseCount: number;
  tagSummary: string[];
};

export function creationWorkMatchCopy(
  creationMode: CreationMode,
): CreationWorkMatchCopy {
  if (creationMode === CreationModeValue.WIKI) {
    return {
      title: "Find an existing catalog entry first",
      description:
        "Search the catalog before creating a release. Selecting a match connects this release to the selected catalog entry or variant target.",
      prominent: true,
    };
  }

  return {
    title: "Work row",
    description:
      "Optional: link this personal release to an existing catalog entry or source variant.",
    prominent: false,
  };
}

export function contentSearchTitle(item: ContentSearchDocument): string {
  return (
    item.translations?.find((translation) => translation.title)?.title ??
    item.titles[0] ??
    item.id
  );
}

export function resolveCreationWorkMatchContext(
  item: ContentSearchDocument,
): CreationWorkMatchContext {
  const targetUnitId =
    item.catalogEntryKind === "VARIANT" && item.targetUnitId
      ? item.targetUnitId
      : item.id;
  return {
    releaseUnitId: item.id,
    title: contentSearchTitle(item),
    targetUnitId,
    isVariant: item.catalogEntryKind === "VARIANT",
    relatedReleaseCount: 1 + (item.collapsedAlternativeUnitIds?.length ?? 0),
    tagSummary: item.tagLabels.slice(0, 6),
  };
}
