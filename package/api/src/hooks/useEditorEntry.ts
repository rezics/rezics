import type { Permission, UnitDTO } from "@rezics/contract";
import { BasicAdminPermission, isBlocked } from "@rezics/contract";
import { computeCanEdit, type OwnerBearing } from "./useCanEdit";
import { useCurrentUserId } from "./useCurrentUserId";
import { useServerPermission } from "./useServerPermission";

export type EditorEntryCollaborativeSurface =
  | "book"
  | "game"
  | "media"
  | "wikiPost";

export type EditorEntryOwnedSurface =
  | "chapter"
  | "entity"
  | "excerpt"
  | "post"
  | "remark"
  | "review"
  | "shelf"
  | "tag"
  | "unit";

export type EditorEntrySurface =
  | EditorEntryCollaborativeSurface
  | EditorEntryOwnedSurface;

export type EditorEntryCapability =
  | "authority"
  | "collaborator"
  | "community"
  | "content"
  | "credit"
  | "metadata"
  | "tag";

export type EditorEntryDecision =
  | {
      canEnter: true;
      reason: "owner" | "admin" | "collaborator" | "community" | "taggable";
    }
  | {
      canEnter: false;
      reason: "anonymous" | "blocked" | "no-capability";
    };

export type ComputeEditorEntryArgs = {
  permission: Permission | null;
  actorUserId: string | null;
  surface: EditorEntrySurface;
  ownerUnit?: OwnerBearing;
  capabilities?: readonly EditorEntryCapability[];
};

export type UseEditorEntryArgs = Omit<
  ComputeEditorEntryArgs,
  "permission" | "actorUserId"
>;

const collaborativeSurfaces = new Set<EditorEntrySurface>([
  "book",
  "game",
  "media",
  "wikiPost",
]);

function ownedResource(surface: EditorEntryOwnedSurface) {
  if (surface === "entity") return "unit";
  if (surface === "excerpt" || surface === "remark" || surface === "review") {
    return "post";
  }
  return surface;
}

function ownerMatches(actorUserId: string | null, ownerUnit?: OwnerBearing) {
  return Boolean(actorUserId && ownerUnit?.user?.unitId === actorUserId);
}

function reasonForCapability(
  capabilities: readonly EditorEntryCapability[],
): Extract<EditorEntryDecision, { canEnter: true }>["reason"] {
  if (capabilities.includes("tag")) return "taggable";
  if (capabilities.includes("collaborator")) return "collaborator";
  return "community";
}

export function computeEditorEntryDecision({
  permission,
  actorUserId,
  surface,
  ownerUnit,
  capabilities = ["content"],
}: ComputeEditorEntryArgs): EditorEntryDecision {
  if (!permission || !actorUserId) {
    return { canEnter: false, reason: "anonymous" };
  }
  if (isBlocked(permission)) {
    return { canEnter: false, reason: "blocked" };
  }
  if (BasicAdminPermission(permission)) {
    return { canEnter: true, reason: "admin" };
  }

  if (collaborativeSurfaces.has(surface)) {
    return capabilities.length > 0
      ? { canEnter: true, reason: reasonForCapability(capabilities) }
      : { canEnter: false, reason: "no-capability" };
  }

  if (
    computeCanEdit(
      permission,
      actorUserId,
      ownedResource(surface as EditorEntryOwnedSurface),
      ownerUnit as UnitDTO | undefined,
    )
  ) {
    return {
      canEnter: true,
      reason: ownerMatches(actorUserId, ownerUnit) ? "owner" : "admin",
    };
  }

  return { canEnter: false, reason: "no-capability" };
}

export function useEditorEntry({
  surface,
  ownerUnit,
  capabilities,
}: UseEditorEntryArgs): EditorEntryDecision {
  const permission = useServerPermission();
  const actorUserId = useCurrentUserId();
  return computeEditorEntryDecision({
    permission,
    actorUserId,
    surface,
    ownerUnit,
    capabilities,
  });
}
