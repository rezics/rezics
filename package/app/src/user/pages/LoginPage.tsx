import { PasswordField } from "@rezics/ui/composite/forms/field/PasswordField.tsx";
import { TextButton } from "@rezics/ui/primitive/button/TextButton.tsx";
import { TextLink } from "@/shared/ui/link";
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
import { useAuthSessionStore } from "@/user/states";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { Layout } from "../layouts/Layout";
import { ModalLayout } from "../layouts/ModalLayout";
import { resolvePostAuthDestination } from "../models/authRedirect";
import { login } from "../models/handler";
import { validateEmail } from "../models/validate";
import * as m from "@rezics/i18n/messages";

interface LoginData {
  email: string;
  password: string;
}

export interface LoginPageProps {
  isModal?: boolean;
  onClose?: () => void;
  /** 当在 AuthModal 中使用时，点击“注册”按钮切换到注册视图 */
  onRegisterClick?: () => void;
}

/**
 * LoginPage - 完整的登录页面容器
 * 合并了原来的 Show/Page 结构
 */
export const LoginPage: FC<LoginPageProps> = ({
  isModal = false,
  onClose,
  onRegisterClick,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<LoginData>({
    email: "",
    password: "",
  });
  const navigate = useNavigate();

  const handleSubmit = async () => {
    let hasError = false;
    setLoading(true);
    setError(undefined);

    try {
      console.log("try to login");
      let validateData: { valid: boolean; error: string | null } = {
        valid: false,
        error: null,
      };
      const email = data?.email;
      validateData = validateEmail(email);
      if (!validateData.valid) throw new Error(validateData.error ?? "");

      const password = data?.password;
      await login(email, password);
    } catch (e: any) {
      hasError = true;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    if (!hasError) {
      const authSessionState = useAuthSessionStore.getState();
      const destination = resolvePostAuthDestination({
        registrationComplete: authSessionState.registration.complete,
      });
      onClose?.();
      navigate({ to: destination });
    }
  };

  const handleRegisterClick = () => {
    if (onRegisterClick) {
      onRegisterClick();
    } else {
      navigate({ to: "/register" });
      console.log("handleRegisterClick");
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
        <Label htmlFor="login-email">{m.common_email()}</Label>
        <Input
          id="login-email"
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
      <div>
        {m.auth_flow_new_to_app()}&nbsp;
        <TextButton onClick={handleRegisterClick}>
          {m.auth_flow_create_account()}
        </TextButton>
        <br />
        <TextLink to="/reset-password">
          {m.auth_flow_forgot_password()}
        </TextLink>
      </div>
      <SocialAuthButtons mode="login" />
    </>
  );

  const actions = (
    <>
      <Button
        className="justify-end"
        type="button"
        disabled={loading}
        onClick={handleSubmit}
      >
        {loading ? m.common_loading() : m.auth_login()}
      </Button>
    </>
  );

  return (
    <LayoutComponent
      title={m.auth_login()}
      content={content}
      actions={actions}
    />
  );
};

export function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="!p-0">
        <LoginPage isModal={true} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
