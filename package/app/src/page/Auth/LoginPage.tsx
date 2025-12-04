import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import {type FC, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {login} from './lib/handler.ts';
import {Layout} from './lib/Layout.tsx';
import {ModalLayout} from './lib/ModalLayout.tsx';
import {Dialog, DialogContent} from '@mui/material';

import {validateEmail, validatePassword} from './lib/validate.ts';
import {useUserStore} from '@/global/userStore.ts';
import {useLocation} from 'wouter';
import {PasswordField} from '@/component/Form/PasswordField';

interface LoginData {
  email: string;
  password: string;
}

export interface LoginShowProps {
  loading: boolean;
  error?: string;
  onSubmit: (data: LoginData) => void;
  showAlreadyLoggedIn?: boolean;
  hideActions?: boolean;
  onRegisterClick?: () => void;
  isModal?: boolean;
}

/**
 * LoginShow - 登录表单展示组件
 * 可以在页面布局中使用，也可以在 Modal 中展示
 */
export const LoginShow: FC<LoginShowProps> = ({
  loading,
  error,
  onSubmit,
  showAlreadyLoggedIn = false,
  hideActions = false,
  onRegisterClick,
  isModal = false,
}) => {
  const {t} = useTranslation();
  const [data, setData] = useState<LoginData>({
    email: '',
    password: '',
  });

  const content = (
    <>
      {showAlreadyLoggedIn && (
        <Alert severity="warning">{t('auth.already_login')}</Alert>
      )}
      {error && (
        <Alert severity="error">
          {error}
          {/* TODO: handle resolve */}
          {/* <Button
            variant="text"
            type="button"
            onClick={() => {
            }}
          >
            {t('auth.resolve')}
          </Button> */}
        </Alert>
      )}
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
    </>
  );

  const actions = !hideActions && (
    <>
      <Button variant="text" type="button" onClick={onRegisterClick}>
        {t('auth.register')}
      </Button>
      <Button
        type="button"
        variant="contained"
        disabled={loading}
        onClick={() => {
          onSubmit(data);
        }}
      >
        {loading ? 'Loading...' : t('auth.login')}
      </Button>
    </>
  );

  const LayoutComponent = isModal ? ModalLayout : Layout;

  return (
    <LayoutComponent
      title={t('auth.login')}
      content={content}
      actions={actions}
    />
  );
};

export interface LoginPageProps {
  isModal?: boolean;
  onClose?: () => void;
}

/**
 * LoginPage - 完整的登录页面容器
 * 包含状态管理和表单处理逻辑
 */
export const LoginPage: FC<LoginPageProps> = ({isModal = false, onClose}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  let hasError = false;
  const {setUser} = useUserStore();
  const [location, navigate] = useLocation();
  const handleSubmit = async (data: LoginData) => {
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
      validateData = validatePassword(password);
      if (!validateData.valid) throw new Error(validateData.error ?? '');

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
    // TODO: Navigate to register page
    navigate('/register');
  };

  return (
    <LoginShow
      loading={loading}
      error={error}
      onSubmit={handleSubmit}
      onRegisterClick={handleRegisterClick}
      isModal={isModal}
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
