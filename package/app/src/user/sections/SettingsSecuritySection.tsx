import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  TextField,
  Typography,
} from "@mui/material";
import {
  useRevokeSessionMutation,
  useSetPasswordMutation,
} from "@rezics/api/auth/auth.mutations";
import { authQueries } from "@rezics/api/auth/auth.queries";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { SessionListItem } from "@/user/components/SessionListItem";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

export const SettingsSecuritySection: FC = () => {
  useRequireAuth();

  const { data: sessionState } = useQuery(authQueries.sessionState());
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery(
    authQueries.sessions(),
  );

  const hasPassword = sessionState?.authSession?.hasPassword ?? false;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const setPassword = useSetPasswordMutation();
  const revokeSession = useRevokeSessionMutation();

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
        title={hasPassword ? "Change Password" : "Set Password"}
        description={
          hasPassword
            ? "Update your password to keep your account secure."
            : "You signed up with a social provider. Set a password to also sign in with email."
        }
      >
        {passwordSuccess && (
          <Alert severity="success" className="mb-4">
            Password {hasPassword ? "changed" : "set"} successfully.
          </Alert>
        )}
        {setPassword.error && (
          <Alert severity="error" className="mb-4">
            {setPassword.error.message}
          </Alert>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            variant="standard"
            required
            inputProps={{ minLength: 6 }}
          />
          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant="standard"
            required
            error={passwordMismatch}
            helperText={passwordMismatch ? "Passwords do not match" : ""}
          />
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={setPassword.isPending || !newPassword || passwordMismatch}
          >
            {setPassword.isPending
              ? "Saving..."
              : hasPassword
                ? "Change Password"
                : "Set Password"}
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Active Sessions"
        description="Manage your active sessions. You can revoke sessions you no longer recognize."
        divider={false}
      >
        {sessionsLoading ? (
          <div className="flex justify-center py-4">
            <CircularProgress size={24} />
          </div>
        ) : Array.isArray(sessions) && sessions.length > 0 ? (
          <div>
            {sessions.map((session: any, i: number) => (
              <div key={session.id ?? session.token}>
                {i > 0 && <Divider />}
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
          <Typography variant="body2" color="text.secondary">
            No active sessions found.
          </Typography>
        )}
      </SettingsSection>
    </div>
  );
};
