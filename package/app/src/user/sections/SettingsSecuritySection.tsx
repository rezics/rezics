import {
  useChangeEmailMutation,
  useRevokeSessionMutation,
  useSetPasswordMutation,
} from "@rezics/api/auth/auth.mutations";
import { authQueries } from "@rezics/api/auth/auth.queries";
import {
  settings_security_active_sessions_description,
  settings_security_active_sessions_title,
  settings_security_change_login_email,
  settings_security_change_password,
  settings_security_change_password_description,
  settings_security_change_password_title,
  settings_security_confirm_password,
  settings_security_current_login_email,
  settings_security_login_email_confirmation_sent,
  settings_security_login_email_description,
  settings_security_login_email_title,
  settings_security_new_login_email,
  settings_security_new_password,
  settings_security_no_active_sessions,
  settings_security_password_changed,
  settings_security_password_set,
  settings_security_passwords_do_not_match,
  settings_security_saving,
  settings_security_sending,
  settings_security_set_password,
  settings_security_set_password_description,
  settings_security_set_password_title,
  settings_security_unavailable,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
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

const i18nMessages = {
  settings_security_active_sessions_description,
  settings_security_active_sessions_title,
  settings_security_change_login_email,
  settings_security_change_password,
  settings_security_change_password_description,
  settings_security_change_password_title,
  settings_security_confirm_password,
  settings_security_current_login_email,
  settings_security_login_email_confirmation_sent,
  settings_security_login_email_description,
  settings_security_login_email_title,
  settings_security_new_login_email,
  settings_security_new_password,
  settings_security_no_active_sessions,
  settings_security_password_changed,
  settings_security_password_set,
  settings_security_passwords_do_not_match,
  settings_security_saving,
  settings_security_sending,
  settings_security_set_password,
  settings_security_set_password_description,
  settings_security_set_password_title,
  settings_security_unavailable,
};

export const SettingsSecuritySection: FC = () => {
  const m = useMessage(i18nMessages);
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

  // Current session token from sessionState
  const currentSessionToken = sessionState?.session?.token;
  const sessions = (sessionsData as any)?.sessions ?? sessionsData ?? [];

  return (
    <div>
      <SettingsSection
        title={m.settings_security_login_email_title()}
        description={m.settings_security_login_email_description()}
      >
        <p className="text-sm text-text-secondary mb-4">
          {m.settings_security_current_login_email({
            email: loginEmail || m.settings_security_unavailable(),
          })}
        </p>
        {loginEmailSuccess && (
          <Alert className="mb-4 text-success-text" aria-live="polite">
            <AlertDescription>
              {m.settings_security_login_email_confirmation_sent()}
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
              {m.settings_security_new_login_email()}
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
              ? m.settings_security_sending()
              : m.settings_security_change_login_email()}
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection
        title={
          hasPassword
            ? m.settings_security_change_password_title()
            : m.settings_security_set_password_title()
        }
        description={
          hasPassword
            ? m.settings_security_change_password_description()
            : m.settings_security_set_password_description()
        }
      >
        {passwordSuccess && (
          <Alert className="mb-4 text-success-text" aria-live="polite">
            <AlertDescription>
              {hasPassword
                ? m.settings_security_password_changed()
                : m.settings_security_password_set()}
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
              {m.settings_security_new_password()}
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
              {m.settings_security_confirm_password()}
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
                {m.settings_security_passwords_do_not_match()}
              </p>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={setPassword.isPending || !newPassword || passwordMismatch}
          >
            {setPassword.isPending
              ? m.settings_security_saving()
              : hasPassword
                ? m.settings_security_change_password()
                : m.settings_security_set_password()}
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection
        title={m.settings_security_active_sessions_title()}
        description={m.settings_security_active_sessions_description()}
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
            {m.settings_security_no_active_sessions()}
          </p>
        )}
      </SettingsSection>
    </div>
  );
};
