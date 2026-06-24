import { useDeleteRealmMutation } from "@rezics/api/realm/realm";
import type { RealmDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useRealmManage } from "../../layouts/realmManageContext";

/**
 * Realm danger management page for ownership visibility and destructive realm
 * deletion. The action row wraps at narrow widths and remains right-aligned.
 *
 * Realm 危险操作管理页：展示所有权并处理删除 realm。操作行在窄屏换行，宽屏
 * 右对齐。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Ownership                │
 * │ Owner name               │
 * │           [Delete]       │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Ownership info          [Delete]   │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Ownership info                  [Delete]   │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function RealmManageDangerPage() {
  const navigate = useNavigate();
  const { realm, canDeleteRealm } = useRealmManage();

  return (
    <RealmOwnershipSection
      realm={realm}
      canDelete={canDeleteRealm}
      onDeleted={() => navigate({ to: "/realm" })}
    />
  );
}

function RealmOwnershipSection({
  realm,
  canDelete,
  onDeleted,
}: {
  realm: RealmDTO;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const { t } = useTranslation(["common", "community"]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteRealm = useDeleteRealmMutation({
    onSuccess: () => {
      toast.success(t("community:realm_deleted"));
      onDeleted();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <section className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div>
        <h2 className="text-lg font-semibold leading-ui text-text-primary">
          {t("community:realm_ownership")}
        </h2>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {t("community:realm_owner")}{" "}
          {realm.user?.name ??
            realm.userId ??
            t("community:realm_unknown_owner")}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={!canDelete}
          onClick={() => setDeleteOpen(true)}
        >
          {t("community:realm_delete")}
        </Button>
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("community:realm_delete_confirm_title")}
            </DialogTitle>
            <DialogDescription>
              {t("community:realm_delete_confirm_description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteRealm.isPending}
              onClick={() => deleteRealm.mutate(realm.unitId)}
            >
              {t("community:realm_delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
