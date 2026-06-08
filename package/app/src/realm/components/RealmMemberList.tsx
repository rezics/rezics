import {
  realmMembersQuery,
  useRemoveMemberMutation,
  useUpdateMemberRoleMutation,
} from "@rezics/api/realm/realm";
import type { RealmMemberDTO } from "@rezics/contract";
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
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";

interface RealmMemberListProps {
  realmId: string;
}

const ROLE_OPTIONS = ["owner", "admin", "moderator", "member"] as const;

export const RealmMemberList: React.FC<RealmMemberListProps> = ({
  realmId,
}) => {
  const queryClient = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>();
  const { data, error, isError, isLoading } = useQuery(
    realmMembersQuery(realmId, { cursor, limit: 50 }),
  );
  const updateRole = useUpdateMemberRoleMutation({
    onSuccess: () => toast.success("Member role updated."),
    onError: (error) => toast.error(error.message),
  });
  const removeMember = useRemoveMemberMutation({
    onSuccess: () => toast.success("Member removed."),
    onError: (error) => toast.error(error.message),
  });
  const [pendingRemove, setPendingRemove] = useState<RealmMemberDTO | null>(
    null,
  );

  if (isError) return <QueryErrorDisplay error={error} />;

  const members = data?.members ?? [];

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <p className="py-4 text-sm leading-body text-text-secondary">
          Loading members...
        </p>
      ) : members.length === 0 ? (
        <p className="py-4 text-sm leading-body text-text-secondary">
          No members found.
        </p>
      ) : (
        members.map((member) => (
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
              <SelectTrigger aria-label="Member role">
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
              Remove
            </Button>
          </div>
        ))
      )}
      {data?.hasMore ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCursor(data.cursor)}
          >
            Load more
          </Button>
        </div>
      ) : null}

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              This removes the member from the realm roster.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removeMember.isPending}
              onClick={async () => {
                if (!pendingRemove) return;
                await removeMember.mutateAsync({
                  realmUnitId: realmId,
                  userId: pendingRemove.userId,
                });
                setPendingRemove(null);
                await queryClient.invalidateQueries({
                  queryKey: realmMembersQuery(realmId).queryKey,
                });
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
