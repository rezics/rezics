import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Dialog, DialogContent } from '@mui/material';
import { type FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';

import { PasswordField } from '@/component/Form/PasswordField';
import { RouterLink } from '@/component/Navigation/RouterLink.tsx';
import { useUserStore } from '@/global/userStore.ts';
import { login } from './lib/handler.ts';
import { Layout } from './lib/Layout.tsx';
import { ModalLayout } from './lib/ModalLayout.tsx';
import { validateEmail } from './lib/validate.ts';
import { TextButton } from '@/component/Common/UI/Button/TextButton.tsx';

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
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<LoginData>({
    email: '',
    password: '',
  });
  const { setUser } = useUserStore();
  const [location, navigate] = useLocation();

  const handleSubmit = async () => {
    let hasError = false;
    setLoading(true);
    setError(undefined);

    try {
      console.log('try to login');
      let validateData: { valid: boolean; error: string | null } = {
        valid: false,
        error: null,
      };
      const email = data?.email;
      validateData = validateEmail(email);
      if (!validateData.valid) throw new Error(validateData.error ?? '');

      const password = data?.password;
      const result = await login(email, password);
      setUser(result?.user);
    } catch (e: any) {
      hasError = true;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    if (!hasError) {
      onClose?.();
      if (location === '/login') {
        navigate('/');
      }
    }
  };

  const handleRegisterClick = () => {
    if (onRegisterClick) {
      onRegisterClick();
    } else {
      navigate('/register');
      console.log('handleRegisterClick');
      onClose?.();
    }
  };

  const LayoutComponent = isModal ? ModalLayout : Layout;

  const content = (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        name="email"
        type="email"
        label={t('common.email')}
        variant="standard"
        required
        value={data?.email}
        onChange={(event: any) => {
          setData({ ...data, email: event.target.value });
        }}
      />
      <PasswordField
        value={data?.password}
        setValue={(value: string) => {
          setData({ ...data, password: value });
        }}
      />
      <div>
        New to ReZICS?&nbsp;
        <TextButton onClick={handleRegisterClick}>Create an account</TextButton>
        <br />
        <RouterLink href="/reset-password">Forget password?</RouterLink>
      </div>
    </>
  );

  const actions = (
    <>
      {/* <Button variant="text" type="button" onClick={handleRegisterClick}>
        {t('auth.register')}
      </Button> */}
      <Button
        className="justify-end"
        type="button"
        variant="contained"
        disabled={loading}
        onClick={handleSubmit}
      >
        {loading ? 'Loading...' : t('auth.login')}
      </Button>
    </>
  );

  return (
    <LayoutComponent
      title={t('auth.login')}
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
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="!p-0">
        <LoginPage isModal={true} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
