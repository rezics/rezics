import {
  useApproveRealmContentMutation,
  useHideRealmContentMutation,
  useRejectRealmContentMutation,
  useRemoveRealmContentMutation,
  useRestoreRealmContentMutation,
  useTombstoneRealmContentMutation,
} from "@rezics/api/governance/governance";
import { useAppendRealmPinboardMutation } from "@rezics/api/realm/realm";
import type { UnitRealmDTO } from "@rezics/contract";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@rezics/ui/shadcn";
import {
  ArchiveX,
  CheckCircle2,
  EyeOff,
  Pin,
  RotateCcw,
  ShieldX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export type RealmContentModerationActionsProps = {
  realmUnitId: string;
  targetUnitId: string;
  unitRealm?: UnitRealmDTO | null;
};

function stopAndConfirm(event: Event, message: string) {
  event.stopPropagation();
  return window.confirm(message);
}

export function RealmContentModerationActions({
  realmUnitId,
  targetUnitId,
  unitRealm,
}: RealmContentModerationActionsProps) {
  const moderationState = unitRealm?.moderationState ?? "approved";
  const visibilityState = unitRealm?.visibilityState ?? "visible";
  const approve = useApproveRealmContentMutation({
    onSuccess: () => toast.success("Approved for this realm."),
    onError: (error) => toast.error(error.message),
  });
  const reject = useRejectRealmContentMutation({
    onSuccess: () => toast.success("Rejected from this realm."),
    onError: (error) => toast.error(error.message),
  });
  const remove = useRemoveRealmContentMutation({
    onSuccess: () => toast.success("Removed from this realm."),
    onError: (error) => toast.error(error.message),
  });
  const hide = useHideRealmContentMutation({
    onSuccess: () => toast.success("Hidden in this realm."),
    onError: (error) => toast.error(error.message),
  });
  const tombstone = useTombstoneRealmContentMutation({
    onSuccess: () => toast.success("Tombstoned in this realm."),
    onError: (error) => toast.error(error.message),
  });
  const restore = useRestoreRealmContentMutation({
    onSuccess: () => toast.success("Restored in this realm."),
    onError: (error) => toast.error(error.message),
  });
  const pin = useAppendRealmPinboardMutation({
    onSuccess: () => toast.success("Post pinned."),
    onError: (error) => toast.error(error.message),
  });

  const relationInput = { reason: "moderator_action" };
  const showApprove = moderationState !== "approved";
  const showReject =
    moderationState !== "rejected" && moderationState !== "removed";
  const showRemove = moderationState !== "removed";
  const showHide = visibilityState !== "hidden";
  const showTombstone = visibilityState !== "tombstoned";
  const showRestoreVisibility = visibilityState !== "visible";

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Realm moderation</DropdownMenuLabel>
        {showApprove ? (
          <DropdownMenuItem
            disabled={approve.isPending}
            onSelect={(event) => {
              if (
                !stopAndConfirm(event, "Approve this content for this realm?")
              ) {
                return;
              }
              approve.mutate({
                realmUnitId,
                targetUnitId,
                input: relationInput,
              });
            }}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Approve for realm
          </DropdownMenuItem>
        ) : null}
        {showReject ? (
          <DropdownMenuItem
            disabled={reject.isPending}
            onSelect={(event) => {
              if (
                !stopAndConfirm(event, "Reject this content from this realm?")
              ) {
                return;
              }
              reject.mutate({
                realmUnitId,
                targetUnitId,
                input: relationInput,
              });
            }}
          >
            <XCircle className="h-4 w-4" aria-hidden />
            Reject from realm
          </DropdownMenuItem>
        ) : null}
        {showRemove ? (
          <DropdownMenuItem
            disabled={remove.isPending}
            onSelect={(event) => {
              if (
                !stopAndConfirm(event, "Remove this content from this realm?")
              ) {
                return;
              }
              remove.mutate({
                realmUnitId,
                targetUnitId,
                input: relationInput,
              });
            }}
          >
            <ShieldX className="h-4 w-4" aria-hidden />
            Remove from realm
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Realm visibility</DropdownMenuLabel>
        {showHide ? (
          <DropdownMenuItem
            disabled={hide.isPending}
            onSelect={(event) => {
              if (!stopAndConfirm(event, "Hide this content in this realm?")) {
                return;
              }
              hide.mutate({
                realmUnitId,
                targetUnitId,
                input: relationInput,
              });
            }}
          >
            <EyeOff className="h-4 w-4" aria-hidden />
            Hide in this realm
          </DropdownMenuItem>
        ) : null}
        {showTombstone ? (
          <DropdownMenuItem
            disabled={tombstone.isPending}
            onSelect={(event) => {
              if (
                !stopAndConfirm(event, "Tombstone this content in this realm?")
              ) {
                return;
              }
              tombstone.mutate({
                realmUnitId,
                targetUnitId,
                input: relationInput,
              });
            }}
          >
            <ArchiveX className="h-4 w-4" aria-hidden />
            Tombstone in this realm
          </DropdownMenuItem>
        ) : null}
        {showRestoreVisibility ? (
          <DropdownMenuItem
            disabled={restore.isPending}
            onSelect={(event) => {
              if (
                !stopAndConfirm(event, "Restore this content in this realm?")
              ) {
                return;
              }
              restore.mutate({
                realmUnitId,
                targetUnitId,
                input: relationInput,
              });
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Restore in this realm
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Organization</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={pin.isPending}
          onSelect={(event) => {
            if (!stopAndConfirm(event, "Pin this content to this realm?")) {
              return;
            }
            pin.mutate({
              realmUnitId,
              unitId: targetUnitId,
            });
          }}
        >
          <Pin className="h-4 w-4" aria-hidden />
          Pin to realm
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );
}
