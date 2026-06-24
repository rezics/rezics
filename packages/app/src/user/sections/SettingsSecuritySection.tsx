import {
  useChangeEmailMutation,
  useRevokeSessionMutation,
  useSetPasswordMutation,
} from "@rezics/contract/api/auth/auth.mutations";
import { authQueries } from "@rezics/contract/api/auth/auth.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { SessionListItem } from "@/user/components/SessionListItem";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

/**
 * 安全部分：管理登录电子邮件、密码和活跃会话。
 * 用户可以更改登录电子邮件、设置或更改密码、查看活跃会话并从远程设备撤销会话。
 *
 * Desktop (≥1024px):
 * ┌─────────────────────────────────────┐
 * │ Change Login Email                  │
 * │ Current: user@example.com           │
 * │ Success: Confirmation sent!         │
 * │ [new-login-email@...] [Change]     │
 * │                                     │
 * │ Set/Change Password                 │
 * │ Success: Password updated!          │
 * │ New Password:  [password....]       │
 * │ Confirm:      [password....]       │
 * │ Passwords do not match!             │
 * │ [Set Password]                      │
 * │                                     │
 * │ Active Sessions                     │
 * │ Device Name • Location              │
 * │ Browser/OS info        [Revoke]    │
 * │ ────────────────────────────────   │
 * │ Another Device • Another Location   │
 * │ Browser/OS info        [Revoke]    │
 * └─────────────────────────────────────┘
 *
 * Tablet (768px-1023px):
 * ┌──────────────────────────────┐
 * │ Change Login Email           │
 * │ Current: user@example.com    │
 * │ [new-email@...]              │
 * │ [Change Email]               │
 * │                              │
 * │ Set/Change Password          │
 * │ New Password: [password...]  │
 * │ Confirm:     [password...]   │
 * │ [Set Password]               │
 * │                              │
 * │ Active Sessions              │
 * │ Device Name • Location       │
 * │ Browser/OS   [Revoke]        │
 * │ ──────────────────────────── │
 * │ Another Device               │
 * │ Browser/OS   [Revoke]        │
 * └──────────────────────────────┘
 *
 * Mobile (480px-767px):
 * ┌──────────────────┐
 * │Security          │
 * │                  │
 * │Change Email      │
 * │user@example.com  │
 * │[new-email...]    │
 * │[Change]          │
 * │                  │
 * │Password          │
 * │[new-pwd...]      │
 * │[confirm...]      │
 * │[Set Password]    │
 * │                  │
 * │Active Sessions   │
 * │Device • Location │
 * │[Revoke]          │
 * │────────────────  │
 * │Another Device    │
 * │[Revoke]          │
 * └──────────────────┘
 *
 * Small Mobile (<480px):
 * ┌──────────┐
 * │Security  │
 * │          │
 * │Email     │
 * │[email]   │
 * │[Change]  │
 * │          │
 * │Password  │
 * │[pwd]     │
 * │[confirm] │
 * │[Set]     │
 * │          │
 * │Sessions  │
 * │Device    │
 * │[Revoke]  │
 * │──────    │
 * │Device2   │
 * │[Revoke]  │
 * └──────────┘
 */
export const SettingsSecuritySection: FC = () => {
  const { t } = useTranslation(["settings"]);
  useRequireAuth();
  const { data: sessionState } = useQuery(authQueries.sessionState());
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery(
    authQueries.sessions(),
  );

  const hasPassword = sessionState?.authAccountState?.hasPassword ?? false;
  const loginEmail = sessionState?.authAccountState?.email ?? "";
  const [newLoginEmail, setNewLoginEmail] = useState("");
  const [loginEmailSuccess, setLoginEmailSuccess] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const setPassword = useSetPasswordMutation();
  const changeEmail = useChangeEmailMutation();
  const revokeSession = useRevokeSessionMutation();

  const handleLoginEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    changeEmail.mutate(
      { newEmail: newLoginEmail },
      {
        onSuccess: () => {
          setLoginEmailSuccess(true);
          setNewLoginEmail("");
          setTimeout(() => setLoginEmailSuccess(false), 3000);
        },
      },
    );
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    setPassword.mutate(
      { newPassword },
      {
        onSuccess: () => {
          setPasswordSuccess(true);
          setNewPassword("");
          setConfirmPassword("");
          setTimeout(() => setPasswordSuccess(false), 3000);
        },
      },
    );
  };

  const handleRevoke = (token: string) => {
    setRevokingToken(token);
    revokeSession.mutate(
      { token },
      { onSettled: () => setRevokingToken(null) },
    );
  };

  const passwordMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const currentSessionToken = sessionState?.session?.token;
  const sessions = (sessionsData as any)?.sessions ?? sessionsData ?? [];

  return (
    <div>
      <SettingsSection
        title={t("settings:security_login_email_title")}
        description={t("settings:security_login_email_description")}
      >
        <p className="text-sm text-text-secondary mb-4">
          {t("settings:security_current_login_email", {
            email: loginEmail || t("settings:security_unavailable"),
          })}
        </p>
        {loginEmailSuccess && (
          <Alert className="mb-4 text-success-text" aria-live="polite">
            <AlertDescription>
              {t("settings:security_login_email_confirmation_sent")}
            </AlertDescription>
          </Alert>
        )}
        {changeEmail.error && (
          <Alert variant="destructive" className="mb-4" aria-live="assertive">
            <AlertDescription>{changeEmail.error.message}</AlertDescription>
          </Alert>
        )}
        <form
          onSubmit={handleLoginEmailSubmit}
          className="flex items-end gap-3 max-w-xl"
        >
          <div className="flex-1 flex flex-col gap-1.5">
            <Label htmlFor="new-login-email">
              {t("settings:security_new_login_email")}
            </Label>
            <Input
              id="new-login-email"
              type="email"
              value={newLoginEmail}
              onChange={(e) => setNewLoginEmail(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={changeEmail.isPending || !newLoginEmail}
            className="gap-2"
          >
            {changeEmail.isPending && <Spinner size="sm" />}
            {changeEmail.isPending
              ? t("settings:security_sending")
              : t("settings:security_change_login_email")}
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection
        title={
          hasPassword
            ? t("settings:security_change_password_title")
            : t("settings:security_set_password_title")
        }
        description={
          hasPassword
            ? t("settings:security_change_password_description")
            : t("settings:security_set_password_description")
        }
      >
        {passwordSuccess && (
          <Alert className="mb-4 text-success-text" aria-live="polite">
            <AlertDescription>
              {hasPassword
                ? t("settings:security_password_changed")
                : t("settings:security_password_set")}
            </AlertDescription>
          </Alert>
        )}
        {setPassword.error && (
          <Alert variant="destructive" className="mb-4" aria-live="assertive">
            <AlertDescription>{setPassword.error.message}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">
              {t("settings:security_new_password")}
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">
              {t("settings:security_confirm_password")}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={passwordMismatch ? "border-border-error" : ""}
            />
            {passwordMismatch && (
              <p className="text-sm text-error-text" aria-live="assertive">
                {t("settings:security_passwords_do_not_match")}
              </p>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={setPassword.isPending || !newPassword || passwordMismatch}
          >
            {setPassword.isPending
              ? t("settings:security_saving")
              : hasPassword
                ? t("settings:security_change_password")
                : t("settings:security_set_password")}
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection
        title={t("settings:security_active_sessions_title")}
        description={t("settings:security_active_sessions_description")}
        divider={false}
      >
        {sessionsLoading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : Array.isArray(sessions) && sessions.length > 0 ? (
          <div>
            {sessions.map((session: any, i: number) => (
              <div key={session.id ?? session.token}>
                {i > 0 && <Separator />}
                <SessionListItem
                  session={session}
                  isCurrent={session.token === currentSessionToken}
                  onRevoke={handleRevoke}
                  revoking={revokingToken === session.token}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            {t("settings:security_no_active_sessions")}
          </p>
        )}
      </SettingsSection>
    </div>
  );
};
