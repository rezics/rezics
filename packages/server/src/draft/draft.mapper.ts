import type { DraftKind, DraftMetadata } from "@rezics/contract";

/** Map a stored post kind to the cross-type `DraftKind`, or null if the kind
 * does not participate in drafts (e.g. EXCERPT, CHAPTER).
 * 将存储的 post 类型映射为跨类型的 `DraftKind`，若该类型不参与草稿（例如
 * EXCERPT、CHAPTER）则返回 null。 */
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

/** The route the client navigates to in order to continue editing a draft.
 * 客户端用于继续编辑草稿时跳转的路由。 */
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

/** Project a per-type draft source into the unified `DraftMetadata`.
 * 将各类型的草稿源投影为统一的 `DraftMetadata`。 */
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
