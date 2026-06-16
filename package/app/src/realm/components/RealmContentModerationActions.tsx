import {
  useApproveRealmContentMutation,
  useRemoveRealmContentMutation,
  useRestoreRealmContentMutation,
  useSetRealmContentLockMutation,
} from "@rezics/api/governance/governance";
import { useAppendRealmPinboardMutation } from "@rezics/api/realm/realm";
import type { UnitRealmDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { ConfirmDialog } from "@rezics/ui";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@rezics/ui/shadcn";
import { CheckCircle2, Lock, Pin, RotateCcw, ShieldX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type RealmContentModerationActionsProps = {
  realmUnitId: string;
  targetUnitId: string;
  unitRealm?: UnitRealmDTO | null;
};

export function RealmContentModerationActions({
  realmUnitId,
  targetUnitId,
  unitRealm,
}: RealmContentModerationActionsProps) {
  const { t } = useTranslation(["community", "common"]);
  const moderationStatus = unitRealm?.moderationStatus ?? "approved";
  const isLocked = unitRealm?.isLocked ?? false;
  const approve = useApproveRealmContentMutation({
    onSuccess: () => toast.success(t("community:moderation_approve_success")),
    onError: (error) => toast.error(error.message),
  });
  const remove = useRemoveRealmContentMutation({
    onSuccess: () => toast.success(t("community:moderation_remove_success")),
    onError: (error) => toast.error(error.message),
  });
  const restore = useRestoreRealmContentMutation({
    onSuccess: () => toast.success(t("community:moderation_restore_success")),
    onError: (error) => toast.error(error.message),
  });
  const setLock = useSetRealmContentLockMutation({
    onSuccess: (_data, variables) =>
      toast.success(
        variables.isLocked
          ? t("community:moderation_lock_success")
          : t("community:moderation_unlock_success"),
      ),
    onError: (error) => toast.error(error.message),
  });
  const pin = useAppendRealmPinboardMutation({
    onSuccess: () => toast.success(t("community:moderation_pin_success")),
    onError: (error) => toast.error(error.message),
  });

  const relationInput = { reason: "moderator_action" };
  const showApprove = moderationStatus !== "approved";
  const showRemove = moderationStatus !== "removed";
  const showRestore = moderationStatus === "removed";

  const [pendingAction, setPendingAction] = useState<{
    execute: () => void;
    message: string;
    variant: "default" | "destructive";
  } | null>(null);

  const requestConfirm = (
    event: { stopPropagation: () => void },
    message: string,
    execute: () => void,
    variant: "default" | "destructive" = "default",
  ) => {
    event.stopPropagation();
    setPendingAction({ execute, message, variant });
  };

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>
          {t("community:moderation_realm_label")}
        </DropdownMenuLabel>
        {showApprove ? (
          <DropdownMenuItem
            disabled={approve.isPending}
            onSelect={(event) => {
              requestConfirm(
                event,
                t("community:moderation_approve_confirm"),
                () =>
                  approve.mutate({
                    realmUnitId,
                    targetUnitId,
                    input: relationInput,
                  }),
              );
            }}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {t("community:moderation_approve_action")}
          </DropdownMenuItem>
        ) : null}
        {showRemove ? (
          <DropdownMenuItem
            disabled={remove.isPending}
            onSelect={(event) => {
              requestConfirm(
                event,
                t("community:moderation_remove_confirm"),
                () =>
                  remove.mutate({
                    realmUnitId,
                    targetUnitId,
                    input: relationInput,
                  }),
                "destructive",
              );
            }}
          >
            <ShieldX className="h-4 w-4" aria-hidden />
            {t("community:moderation_remove_action")}
          </DropdownMenuItem>
        ) : null}
        {showRestore ? (
          <DropdownMenuItem
            disabled={restore.isPending}
            onSelect={(event) => {
              requestConfirm(
                event,
                t("community:moderation_restore_confirm"),
                () =>
                  restore.mutate({
                    realmUnitId,
                    targetUnitId,
                    input: relationInput,
                  }),
              );
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t("community:moderation_restore_action")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          disabled={setLock.isPending}
          onSelect={(event) => {
            const nextLocked = !isLocked;
            requestConfirm(
              event,
              nextLocked
                ? t("community:moderation_lock_confirm")
                : t("community:moderation_unlock_confirm"),
              () =>
                setLock.mutate({
                  realmUnitId,
                  targetUnitId,
                  isLocked: nextLocked,
                  input: relationInput,
                }),
              nextLocked ? "default" : "default",
            );
          }}
        >
          <Lock className="h-4 w-4" aria-hidden />
          {isLocked
            ? t("community:moderation_unlock_action")
            : t("community:moderation_lock_action")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>
          {t("community:moderation_organization_label")}
        </DropdownMenuLabel>
        <DropdownMenuItem
          disabled={pin.isPending}
          onSelect={(event) => {
            requestConfirm(event, t("community:moderation_pin_confirm"), () =>
              pin.mutate({
                realmUnitId,
                unitId: targetUnitId,
              }),
            );
          }}
        >
          <Pin className="h-4 w-4" aria-hidden />
          {t("community:moderation_pin_action")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <ConfirmDialog
        open={pendingAction !== null}
        onConfirm={() => {
          pendingAction?.execute();
          setPendingAction(null);
        }}
        onCancel={() => setPendingAction(null)}
        title={pendingAction?.message ?? ""}
        confirmLabel={t("common:confirm")}
        cancelLabel={t("common:cancel")}
        variant={pendingAction?.variant ?? "default"}
      />
    </>
  );
}
