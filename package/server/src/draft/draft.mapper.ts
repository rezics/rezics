import type { DraftKind, DraftMetadata } from "@rezics/contract";

/** Map a stored post kind to the cross-type `DraftKind`, or null if the kind
 * does not participate in drafts (e.g. EXCERPT, CHAPTER). */
export function postKindToDraftKind(kind: string | null): DraftKind | null {
  switch (kind) {
    case "REVIEW":
      return "review";
    case "REMARK":
      return "remark";
    case "WIKI":
      return "wiki";
    case "POST":
      return "post";
    default:
      return null;
  }
}

/** The route the client navigates to in order to continue editing a draft. */
export function draftResumeRoute(kind: DraftKind, unitId: string): string {
  switch (kind) {
    case "review":
      return `/review/${unitId}`;
    case "remark":
      return `/remark/${unitId}`;
    case "wiki":
    case "post":
      return `/post/${unitId}`;
    case "shelf-description":
      return `/shelf/${unitId}/edit`;
  }
}

export interface DraftSource {
  unitId: string;
  kind: DraftKind;
  title: string;
  excerpt?: string;
  updatedAt: string;
  targetUnitId?: string | null;
}

/** Project a per-type draft source into the unified `DraftMetadata`. */
export function toDraftMetadata(src: DraftSource): DraftMetadata {
  return {
    id: src.unitId,
    kind: src.kind,
    title: src.title,
    ...(src.excerpt ? { excerpt: src.excerpt } : {}),
    updatedAt: src.updatedAt,
    targetUnitId: src.targetUnitId ?? null,
    resumeRoute: draftResumeRoute(src.kind, src.unitId),
  };
}
