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
  workUnitId: string | null;
  createsHiddenWork: boolean;
  sameWorkReleaseCount: number;
  workTagSummary: string[];
};

export function creationWorkMatchCopy(
  creationMode: CreationMode,
): CreationWorkMatchCopy {
  if (creationMode === CreationModeValue.WIKI) {
    return {
      title: "Find an existing work first",
      description:
        "Search the catalog before creating a release. Selecting a match binds this release to the existing canonical work; standalone matches will create a hidden work domain for both releases.",
      prominent: true,
    };
  }

  return {
    title: "Work row",
    description:
      "Optional: link this personal release to an existing catalog release so future work-domain context stays precise.",
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
  return {
    releaseUnitId: item.id,
    title: contentSearchTitle(item),
    workUnitId: item.workUnitId,
    createsHiddenWork: !item.workUnitId,
    sameWorkReleaseCount: 1 + (item.collapsedAlternativeUnitIds?.length ?? 0),
    workTagSummary: item.tagLabels.slice(0, 6),
  };
}
