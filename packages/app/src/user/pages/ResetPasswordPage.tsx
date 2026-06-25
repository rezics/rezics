import {
  requestPasswordReset,
  resetPassword,
} from "@rezics/contract/api/auth/auth.mutations";
import { useTranslation } from "@rezics/i18n/react";
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
import { type FC, type FormEvent, useMemo, useState } from "react";
import { Layout } from "../layouts/Layout.tsx";
import { ModalLayout } from "../layouts/ModalLayout.tsx";
import { validateEmail, validatePassword } from "../models/validate.ts";

export interface ResetPasswordPageProps {
  isModal?: boolean;
  onClose?: () => void;
}

/**
 * Password reset flow page supporting two modes: email request form and token-based
 * password reset form. Can render as a standalone page or within a modal dialog.
 * 密码重置流程页面，支持两种模式：邮箱请求表单和基于令牌的密码重置表单。可作为独立页面或模态对话框呈现。
 *
 * Layout (Standalone Mode):
 *
 * Mobile (<640px):
 * ┌──────────────────────┐
 * │ Reset Password       │
 * ├──────────────────────┤
 * │ [Error/Message]      │
 * │                      │
 * │ Email Request:       │
 * │ [Email Input]        │
 * │ [Back to Login Link] │
 * │                      │
 * │ [Send Reset Link]    │
 * └──────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌───────────────────────────┐
 * │ Reset Your Password       │
 * ├───────────────────────────┤
 * │ [Error or Success Alert]  │
 * │                           │
 * │ [Email Input - full w]    │
 * │ [Back to Login Link]      │
 * │                           │
 * │ [Send Reset Link Button]  │
 * └───────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌─────────────────────────────────┐
 * │ Reset Password                  │
 * ├─────────────────────────────────┤
 * │ [Error/Success Alert]           │
 * │                                 │
 * │ Email Input:                    │
 * │ [Email Input Field]             │
 * │                                 │
 * │ [Back to Login Link]            │
 * │                                 │
 * │              [Send Reset Link]  │
 * └─────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌──────────────────────────────────────┐
 * │ Reset Your Password                  │
 * ├──────────────────────────────────────┤
 * │ [Error/Success Alert - full width]   │
 * │                                      │
 * │ Enter your email to receive link:    │
 * │ [Email Input Field]                  │
 * │                                      │
 * │ [Back to Login Link]                 │
 * │                                      │
 * │                  [Send Reset Link]   │
 * └──────────────────────────────────────┘
 *
 * Modal Mode: Renders within Dialog with same content, optimized for center alignment.
 */
export const ResetPasswordPage: FC<ResetPasswordPageProps> = ({
  isModal = false,
  onClose,
}) => {
  const { t } = useTranslation(["auth", "common"]);
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
    linkError === "INVALID_TOKEN" ? t("auth:reset_invalid_token") : undefined,
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

      const response = await requestPasswordReset({
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
        throw new Error(validated.error ?? t("auth:error_invalid_password"));
      }

      if (password !== confirmPassword) {
        throw new Error(t("auth:error_passwords_mismatch"));
      }

      if (!resetToken) {
        throw new Error(t("auth:reset_missing_token"));
      }

      await resetPassword({
        newPassword: password,
        token: resetToken,
      });

      setMessage(t("auth:reset_success_redirecting"));
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (resetToken) {
      handleResetPassword();
    } else {
      handleRequestReset();
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
          <Label htmlFor="reset-email">{t("common:email")}</Label>
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
        <TextButton onClick={handleLoginClick}>
          {t("auth:reset_back_to_login")}
        </TextButton>
      </div>
    </>
  );

  const actions = (
    <>
      <Button type="submit" disabled={loading} className="gap-2">
        {loading && <Spinner size="sm" />}
        {loading
          ? resetToken
            ? t("common:loading")
            : t("auth:flow_reset_link_sending")
          : resetToken
            ? t("auth:reset_title")
            : t("auth:reset_send_link")}
      </Button>
    </>
  );

  return (
    <LayoutComponent
      title={t("auth:reset_title")}
      content={content}
      actions={actions}
      onSubmit={handleSubmit}
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
