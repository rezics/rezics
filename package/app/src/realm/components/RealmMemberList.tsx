import {
  realmKeys,
  realmMembersQuery,
  useRemoveMemberMutation,
  useUpdateMemberRoleMutation,
} from "@rezics/api/realm/realm";
import { type RealmMemberDTO, realmMemberRoles } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { QueryBoundary } from "@/core";

interface RealmMemberListProps {
  realmId: string;
}

const ROLE_OPTIONS = realmMemberRoles;

export const RealmMemberList: React.FC<RealmMemberListProps> = ({
  realmId,
}) => {
  const { t } = useTranslation(["community", "common"]);
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>();
  const memberQuery = useQuery(
    realmMembersQuery(realmId, { cursor, limit: 50 }),
  );
  const updateRole = useUpdateMemberRoleMutation();
  const removeMember = useRemoveMemberMutation();
  const [pendingRemove, setPendingRemove] = useState<RealmMemberDTO | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-3">
      <QueryBoundary
        query={memberQuery}
        isEmpty={(data) => (data?.members ?? []).length === 0}
        emptyTitle={t("community:member_empty")}
      >
        {(data) => (
          <>
            {(data.members ?? []).map((member) => (
              <div
                key={member.userId}
                className="grid gap-3 rounded-md bg-surface-subtle p-3 md:grid-cols-[minmax(0,1fr)_10rem_auto]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.user?.avatar ?? undefined} />
                    <AvatarFallback>
                      {(member.user?.name ?? member.userId).slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-ui text-text-primary">
                      {member.user?.name ?? member.user?.slug ?? member.userId}
                    </p>
                    <p className="truncate text-xs leading-ui text-text-secondary">
                      {member.state ?? "active"} · {member.userId}
                    </p>
                  </div>
                </div>
                <Select
                  value={member.roleKey}
                  onValueChange={(roleKey) =>
                    updateRole.mutate({
                      realmUnitId: realmId,
                      userId: member.userId,
                      input: { roleKey },
                    })
                  }
                  disabled={updateRole.isPending}
                >
                  <SelectTrigger aria-label={t("community:member_role_aria")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setPendingRemove(member)}
                >
                  {t("common:remove")}
                </Button>
              </div>
            ))}
            {data.hasMore ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCursor(data.cursor)}
                >
                  {t("common:load_more")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </QueryBoundary>

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("community:member_remove_title")}</DialogTitle>
            <DialogDescription>
              {t("community:member_remove_description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingRemove(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={removeMember.isPending}
              onClick={async () => {
                if (!pendingRemove) return;
                try {
                  await removeMember.mutateAsync({
                    realmUnitId: realmId,
                    userId: pendingRemove.userId,
                  });
                  setPendingRemove(null);
                  // Use broad prefix to invalidate all paginated member queries
                  // 使用更宽泛的前缀以失效所有分页成员查询
                  await queryClient.invalidateQueries({
                    queryKey: realmKeys.members(realmId),
                  });
                } catch {
                  // Mutation onError already shows a toast; just keep the dialog open for retry.
                  // 变更 onError 已弹出提示；保持对话框打开以便重试。
                }
              }}
            >
              {t("common:remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
