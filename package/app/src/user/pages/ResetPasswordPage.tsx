import { authApi } from "@rezics/api/auth/auth.api";
import { Spinner } from "@rezics/ui";
import { PasswordField } from "@rezics/ui/composite/forms/field/PasswordField.tsx";
import { TextButton } from "@rezics/ui/primitive/button/TextButton.tsx";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { type FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "../layouts/Layout.tsx";
import { ModalLayout } from "../layouts/ModalLayout.tsx";
import { validateEmail, validatePassword } from "../models/validate.ts";

export interface ResetPasswordPageProps {
  isModal?: boolean;
  onClose?: () => void;
}
export const ResetPasswordPage: FC<ResetPasswordPageProps> = ({
  isModal = false,
  onClose,
}) => {
  const { t } = useTranslation();
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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="text-success-text">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {!resetToken ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
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
        disabled={loading}
        onClick={resetToken ? handleResetPassword : handleRequestReset}
        className="gap-2"
      >
        {loading && <Spinner size="sm" />}
        {loading
          ? resetToken
            ? t("common.loading")
            : t("auth.flow.reset_link_sending")
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!p-0">
        <ResetPasswordPage isModal={true} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
