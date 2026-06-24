"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
} from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | Security                      |
 * | Manage your password...       |
 * |-------------------------------|
 * | [Card: Change Password]       |
 * | Current      [*****         ] |
 * | New          [*****         ] |
 * | Confirm      [*****         ] |
 * |              [Change Pwd    ] |
 * |-------------------------------|
 * | [Card: Two-Factor Auth]       |
 * | 2FA desc       [switch      ] |
 * |-------------------------------|
 * | [Card: Active Sessions]       |
 * | Current session               |
 * |        [Revoke All Others   ] |
 * +-------------------------------+
 * 所有卡片 full-width 纵向堆叠。
 *
 * Tablet (640-1023px):
 * 与 Mobile 一致。
 *
 * Desktop (1024-1535px):
 * 受 settings layout flex-1 约束，
 * 卡片 w-full。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致。
 */
export function SettingsSecurityContent({
  initialTwoFactorEnabled = false,
}: {
  readonly initialTwoFactorEnabled?: boolean;
} = {}) {
  const [t] = useT();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    initialTwoFactorEnabled,
  );
  const [revokingAll, setRevokingAll] = useState(false);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error({ title: t.settings.passwordMismatch });
      return;
    }
    setChangingPassword(true);
    try {
      await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      toast.success({ title: t.settings.saved });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error({ title: t.common.error });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleRevokeAll() {
    setRevokingAll(true);
    try {
      await authClient.revokeOtherSessions();
      toast.success({ title: t.settings.saved });
    } catch {
      toast.error({ title: t.common.error });
    } finally {
      setRevokingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t.settings.security}</h2>
        <p className="text-muted-foreground text-sm">
          {t.settings.securityDescription}
        </p>
      </div>

      <Card>
        <form className="flex min-h-0 flex-col" onSubmit={handleChangePassword}>
          <CardHeader title={t.settings.changePassword} />
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="settings-currentPwd"
              >
                {t.settings.currentPassword}
              </label>
              <PasswordInput>
                <PasswordInputGroup>
                  <PasswordInputInput
                    id="settings-currentPwd"
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    value={currentPassword}
                  />
                  <PasswordInputTrigger />
                </PasswordInputGroup>
              </PasswordInput>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="settings-newPwd">
                {t.settings.newPassword}
              </label>
              <PasswordInput>
                <PasswordInputGroup>
                  <PasswordInputInput
                    id="settings-newPwd"
                    onChange={(e) => setNewPassword(e.target.value)}
                    value={newPassword}
                  />
                  <PasswordInputTrigger />
                </PasswordInputGroup>
              </PasswordInput>
            </div>
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="settings-confirmPwd"
              >
                {t.settings.confirmPassword}
              </label>
              <PasswordInput>
                <PasswordInputGroup>
                  <PasswordInputInput
                    id="settings-confirmPwd"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    value={confirmPassword}
                  />
                  <PasswordInputTrigger />
                </PasswordInputGroup>
              </PasswordInput>
            </div>
          </CardContent>
          <CardFooter>
            <Button isLoading={changingPassword} type="submit">
              {t.settings.changePassword}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.twoFactor}</CardTitle>
          <CardDescription>{t.settings.twoFactorDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {twoFactorEnabled
                ? t.settings.twoFactorEnabled
                : t.settings.twoFactorDisabled}
            </span>
            <Switch
              checked={twoFactorEnabled}
              onCheckedChange={(detail) => setTwoFactorEnabled(detail.checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          description={t.settings.activeSessionsDescription}
          title={t.settings.activeSessions}
        />
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t.settings.currentSession}
          </p>
        </CardContent>
        <CardFooter>
          <Button
            isLoading={revokingAll}
            onClick={handleRevokeAll}
            variant="outline"
          >
            {t.settings.revokeAllSessions}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function SettingsSecurityPage() {
  return <SettingsSecurityContent />;
}
