import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import {Dialog, DialogContent} from '@mui/material';
import {useNavigate, useRouterState} from '@tanstack/react-router';
import {type FC, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {PasswordField} from '@package/ui/composite/form/field/PasswordField.tsx';
import {MUILink} from '@package/ui/primitive/link/MUILink.tsx';
import {login} from '../model/handler';
import {Layout} from '../layout/Layout';
import {ModalLayout} from '../layout/ModalLayout';
import {validateEmail} from '../model/validate';
import {TextButton} from '@package/ui/primitive/button/TextButton.tsx';
import {SocialAuthButtons} from '../component/SocialAuthButtons';
import {resolvePostAuthDestination} from '../model/authRedirect';

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
  const {t} = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<LoginData>({
    email: '',
    password: '',
  });
  const navigate = useNavigate();
  const pathname = useRouterState({select: s => s.location.pathname});

  const handleSubmit = async () => {
    let hasError = false;
    setLoading(true);
    setError(undefined);

    try {
      console.log('try to login');
      let validateData: {valid: boolean; error: string | null} = {
        valid: false,
        error: null,
      };
      const email = data?.email;
      validateData = validateEmail(email);
      if (!validateData.valid) throw new Error(validateData.error ?? '');

      const password = data?.password;
      await login(email, password);
    } catch (e: any) {
      hasError = true;
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    if (!hasError) {
      onClose?.();
      if (pathname === '/login') {
        const {useAuthSessionStore} = await import('@/user/state');
        const authSessionState = useAuthSessionStore.getState();
        navigate({
          to: resolvePostAuthDestination({
            needsOnboarding: authSessionState.needsOnboarding,
            needsVerification: authSessionState.needsVerification,
            readyForApp: authSessionState.capabilityLevel === 'member',
          }),
        });
      }
    }
  };

  const handleRegisterClick = () => {
    if (onRegisterClick) {
      onRegisterClick();
    } else {
      navigate({to: '/register'});
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
          setData({...data, email: event.target.value});
        }}
      />
      <PasswordField
        value={data?.password}
        setValue={(value: string) => {
          setData({...data, password: value});
        }}
      />
      <div>
        {t('auth.flow.new_to_app')}&nbsp;
        <TextButton onClick={handleRegisterClick}>
          {t('auth.flow.create_account')}
        </TextButton>
        <br />
        <MUILink to="/reset-password">{t('auth.flow.forgot_password')}</MUILink>
      </div>
      <SocialAuthButtons mode="login" />
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
        {loading ? t('common.loading') : t('auth.login')}
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
