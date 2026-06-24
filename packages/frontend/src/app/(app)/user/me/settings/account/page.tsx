"use client";

import { useAtomSet } from "@effect/atom-react";
import { type FormEvent, useState } from "react";
import { updateProfileAtom } from "@/atoms/users";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | Account                       |
 * | Manage your account...        |
 * |-------------------------------|
 * | [Card: Profile]               |
 * | Display Name [input         ] |
 * | Username     [input         ] |
 * | Email        [input         ] |
 * |              [Save          ] |
 * |-------------------------------|
 * | [Card: Danger Zone]           |
 * | Delete Account                |
 * | description text...           |
 * |              [Delete Account] |
 * +-------------------------------+
 * w-full, 表单输入 full-width 堆叠。
 *
 * Tablet (640-1023px):
 * 与 Mobile 一致，卡片 full-width。
 *
 * Desktop (1024-1535px):
 * 内容区受 settings layout flex-1 约束，
 * 卡片 w-full 撑满内容区。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致。
 */
export function SettingsAccountContent({
  initialDisplayName = "",
  initialEmail = "",
  initialUsername = "",
}: {
  readonly initialDisplayName?: string;
  readonly initialEmail?: string;
  readonly initialUsername?: string;
} = {}) {
  const [t] = useT();
  const updateProfile = useAtomSet(updateProfileAtom, { mode: "promise" });
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ payload: { name: displayName } });
      toast.success({ title: t.settings.saved });
    } catch {
      toast.error({ title: t.common.error });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t.settings.account}</h2>
        <p className="text-muted-foreground text-sm">
          {t.settings.accountDescription}
        </p>
      </div>

      <Card>
        <form className="flex min-h-0 flex-col" onSubmit={handleSave}>
          <CardHeader title={t.settings.account} />
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="settings-displayName"
              >
                {t.settings.displayName}
              </label>
              <Input
                id="settings-displayName"
                onChange={(e) => setDisplayName(e.target.value)}
                value={displayName}
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="settings-username"
              >
                {t.settings.username}
              </label>
              <Input
                id="settings-username"
                onChange={(e) => setUsername(e.target.value)}
                value={username}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="settings-email">
                {t.settings.email}
              </label>
              <Input
                id="settings-email"
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                value={email}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button isLoading={saving} type="submit">
              {t.common.save}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Separator />

      <Card>
        <CardHeader
          description={t.settings.deleteAccountDescription}
          title={t.settings.deleteAccount}
        />
        <CardFooter>
          <Button
            onClick={() => {
              // Account deletion handled by a confirmation dialog in a future iteration
              // 账号删除将在后续迭代中通过确认对话框处理
            }}
            variant="destructive"
          >
            {t.settings.deleteAccount}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function SettingsAccountPage() {
  return <SettingsAccountContent />;
}
