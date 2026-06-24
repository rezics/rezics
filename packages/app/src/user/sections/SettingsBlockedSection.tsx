import {
  useBlockUserMutation,
  useUnblockUserMutation,
} from "@rezics/contract/api/block/block.mutations";
import { blockQueries } from "@rezics/contract/api/block/block.queries";
import { userQueries } from "@rezics/contract/api/user/user.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription, Button, Input } from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

/**
 * 已屏蔽用户部分：显示被屏蔽的用户列表，允许添加新屏蔽和解除屏蔽。
 * 用户可以输入用户名或句柄来屏蔽账户，查看所有已屏蔽用户的头像和名称，并解除屏蔽。
 *
 * Desktop (≥1024px):
 * ┌─────────────────────────────────────┐
 * │ Blocked Users                       │
 * │ [username/handle input]   [Block]   │
 * │ Error message if any               │
 * │                                     │
 * │ [Avatar] Name @handle  [Unblock]   │
 * │ [Avatar] Name @handle  [Unblock]   │
 * │ [Avatar] Name @handle  [Unblock]   │
 * └─────────────────────────────────────┘
 *
 * Tablet (768px-1023px):
 * ┌──────────────────────────────┐
 * │ Blocked Users                │
 * │ [username/handle]            │
 * │ [Block]                      │
 * │                              │
 * │ [Avatar] Name @handle        │
 * │ [Unblock]                    │
 * │ [Avatar] Name @handle        │
 * │ [Unblock]                    │
 * └──────────────────────────────┘
 *
 * Mobile (480px-767px):
 * ┌──────────────────┐
 * │Blocked Users     │
 * │[username]        │
 * │[Block]           │
 * │                  │
 * │[Avatar] Name     │
 * │@handle [Unblock] │
 * │[Avatar] Name     │
 * │@handle [Unblock] │
 * └──────────────────┘
 *
 * Small Mobile (<480px):
 * ┌──────────┐
 * │Blocked   │
 * │[user]    │
 * │[Block]   │
 * │          │
 * │[A]Name   │
 * │[Unblock] │
 * │[A]Name   │
 * │[Unblock] │
 * └──────────┘
 */
export const SettingsBlockedSection: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  useRequireAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery(blockQueries.list());
  const blockUser = useBlockUserMutation();
  const unblockUser = useUnblockUserMutation();

  const [handle, setHandle] = useState("");
  const [addError, setAddError] = useState("");

  const blocked = data?.items ?? [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = handle.trim().replace(/^@/, "");
    if (!slug) return;
    setAddError("");
    try {
      const user = await qc.fetchQuery(userQueries.bySlug(slug));
      blockUser.mutate(
        { userId: user.unitId },
        { onSuccess: () => setHandle("") },
      );
    } catch {
      setAddError(t("settings:blocked_add_not_found"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <SettingsSection
      title={t("settings:blocked_title")}
      description={t("settings:blocked_description")}
      divider={false}
    >
      <form onSubmit={handleAdd} className="flex items-end gap-3 mb-6">
        <div className="flex-1 flex flex-col gap-1.5">
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder={t("settings:blocked_add_placeholder")}
            aria-label={t("settings:blocked_add_label")}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={!handle.trim() || blockUser.isPending}
        >
          {blockUser.isPending && <Spinner size="sm" />}
          {t("settings:blocked_add_button")}
        </Button>
      </form>

      {addError && (
        <Alert variant="destructive" className="mb-4" aria-live="assertive">
          <AlertDescription>{addError}</AlertDescription>
        </Alert>
      )}

      {blocked.length === 0 ? (
        <p className="text-sm text-text-secondary">
          {t("settings:blocked_empty")}
        </p>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {blocked.map((u) => (
            <li
              key={u.unitId}
              className="flex items-center gap-3 px-3 py-2 rounded bg-surface-elevated"
            >
              {u.avatar ? (
                <img
                  src={u.avatar}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-surface-sunken" />
              )}
              <span className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium truncate">
                  {u.name ?? u.slug ?? u.unitId}
                </span>
                {u.slug && (
                  <span className="text-xs text-text-secondary truncate">
                    @{u.slug}
                  </span>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={unblockUser.isPending}
                onClick={() => unblockUser.mutate(u.unitId)}
              >
                {t("settings:blocked_unblock")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
};
