import { Dialog, DialogContent } from "@mui/material";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { authApi } from "@rezics/api/auth/auth.api";
import { PasswordField } from "@rezics/ui/composite/form/field/PasswordField.tsx";
import { TextButton } from "@rezics/ui/primitive/button/TextButton.tsx";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { type FC, useMemo, useState } from "react";
import { Layout } from "../layout/Layout.tsx";
import { ModalLayout } from "../layout/ModalLayout.tsx";
import { validateEmail, validatePassword } from "../model/validate.ts";

export interface ResetPasswordPageProps {
  isModal?: boolean;
  onClose?: () => void;
}
export const ResetPasswordPage: FC<ResetPasswordPageProps> = ({
  isModal = false,
  onClose,
}) => {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const query = useMemo(() => {
    if (typeof window === "undefined") {
      return new URLSearchParams();
    }

    return new URLSearchParams(window.location.search);
  }, []);
  const resetToken = query.get("token");
  const linkError = query.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>(
    linkError === "INVALID_TOKEN"
      ? "This password reset link is invalid or expired."
      : undefined,
  );

  const handleLoginClick = () => {
    navigate({ to: "/login" });
  };

  const handleRequestReset = async () => {
    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const validated = validateEmail(email);
      if (!validated.valid) {
        throw new Error(validated.error ?? "Invalid email address");
      }

      const redirectTo =
        typeof window === "undefined"
          ? "/reset-password"
          : `${window.location.origin}/reset-password`;

      const response = await authApi.requestPasswordReset({
        email,
        redirectTo,
      });
      setMessage(response.message);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const validated = validatePassword(password);
      if (!validated.valid) {
        throw new Error(validated.error ?? "Invalid password");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      if (!resetToken) {
        throw new Error("Missing password reset token.");
      }

      await authApi.resetPassword({
        newPassword: password,
        token: resetToken,
      });

      setMessage("Password updated. Redirecting to login...");
      onClose?.();

      if (pathname === "/reset-password") {
        setTimeout(() => navigate({ to: "/login" }), 600);
      }
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const LayoutComponent = isModal ? ModalLayout : Layout;

  const content = (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      {!resetToken ? (
        <TextField
          name="email"
          type="email"
          label="Email"
          variant="standard"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      ) : (
        <>
          <PasswordField value={password} setValue={setPassword} />
          <PasswordField
            value={confirmPassword}
            setValue={setConfirmPassword}
          />
        </>
      )}
      <div>
        <TextButton onClick={handleLoginClick}>Back to Login</TextButton>
      </div>
    </>
  );

  const actions = (
    <>
      <Button
        type="button"
        variant="contained"
        disabled={loading}
        onClick={resetToken ? handleResetPassword : handleRequestReset}
      >
        {loading
          ? "Loading..."
          : resetToken
            ? "Reset Password"
            : "Send Reset Link"}
      </Button>
    </>
  );

  return (
    <LayoutComponent
      title="Reset Password"
      content={content}
      actions={actions}
    />
  );
};

export function ResetPasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="!p-0">
        <ResetPasswordPage isModal={true} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
