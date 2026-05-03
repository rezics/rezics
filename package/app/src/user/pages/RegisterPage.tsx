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
import { useNavigate } from "@tanstack/react-router";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthSessionStore } from "@/user/states";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { Layout } from "../layouts/Layout.tsx";
import { ModalLayout } from "../layouts/ModalLayout.tsx";
import { resolvePostAuthDestination } from "../models/authRedirect";
import { register } from "../models/handler.ts";
import { validateEmail, validatePassword } from "../models/validate.ts";

interface RegisterData {
  email: string;
  password: string;
  confirm: string;
}

export interface RegisterPageProps {
  isModal?: boolean;
  onClose?: () => void;
  /** 当在 AuthModal 中使用时，点击“登录”按钮切换回登录视图 */
  onLoginClick?: () => void;
}

/**
 * RegisterPage - 完整的注册页面容器
 * 合并了原来的 Show/Page 结构，并复用 GetVerificationCode 组件
 */
export const RegisterPage: FC<RegisterPageProps> = ({
  isModal = false,
  onClose,
  onLoginClick,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<RegisterData>({
    email: "",
    password: "",
    confirm: "",
  });
  const navigate = useNavigate();

  const handleSubmit = async () => {
    let hasError = false;
    setLoading(true);
    setError(undefined);
    try {
      let validateData: { valid: boolean; error: string | null } = {
        valid: false,
        error: null,
      };
      const email = data?.email;
      validateData = validateEmail(email);
      if (!validateData.valid) throw new Error(validateData.error ?? "");

      const password = data?.password;
      validateData = validatePassword(password);
      if (!validateData.valid) throw new Error(validateData.error ?? "");

      const confirm = data?.confirm;
      validateData = validatePassword(confirm);
      if (!validateData.valid) throw new Error(validateData.error ?? "");
      if (password !== confirm) {
        throw new Error(t("auth.error.passwords_mismatch"));
      }

      await register(email, password);
    } catch (e) {
      setError((e as Error).message);
      hasError = true;
    } finally {
      setLoading(false);
    }
    if (!hasError) {
      const authSessionState = useAuthSessionStore.getState();
      const destination = resolvePostAuthDestination({
        registrationComplete: authSessionState.registrationComplete,
      });
      onClose?.();
      navigate({ to: destination });
    }
  };

  const handleLoginClickInternal = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      navigate({ to: "/login" });
      onClose?.();
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-email">{t("common.email")}</Label>
        <Input
          id="register-email"
          name="email"
          type="email"
          required
          value={data?.email}
          onChange={(event) => {
            setData({ ...data, email: event.target.value });
          }}
        />
      </div>
      <PasswordField
        value={data?.password}
        setValue={(value: string) => {
          setData({ ...data, password: value });
        }}
      />
      <PasswordField
        value={data?.confirm}
        setValue={(value: string) => {
          setData({ ...data, confirm: value });
        }}
      />
      <div>
        {t("auth.flow.already_have_account")}&nbsp;
        <TextButton onClick={handleLoginClickInternal}>
          {t("auth.flow.sign_in_instead")}
        </TextButton>
      </div>
      <SocialAuthButtons mode="register" />
    </>
  );

  const actions = (
    <>
      <Button type="button" disabled={loading} onClick={handleSubmit}>
        {loading ? t("common.loading") : t("auth.register")}
      </Button>
    </>
  );

  return (
    <LayoutComponent
      title={t("auth.register")}
      content={content}
      actions={actions}
    />
  );
};

export function RegisterModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!p-0">
        <RegisterPage isModal={true} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
