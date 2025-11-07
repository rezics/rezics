import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import {type FC, useState} from 'react';
import type React from 'react';
import {useTranslation} from 'react-i18next';
import {register} from './lib/handler.ts';
import {Layout} from './lib/Layout.tsx';
import {ModalLayout} from './lib/ModalLayout.tsx';
import {validateEmail, validateName, validatePassword} from './lib/validate.ts';
import {Dialog, DialogContent} from '@mui/material';
import {useUserStore} from '@/global/userStore.ts';

export interface RegisterShowProps {
  loading: boolean;
  error?: string;
  onSubmit: (data: RegisterData) => void;
  hideActions?: boolean;
  onLoginClick?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirm: string;
}

/**
 * RegisterShow - 注册表单展示组件
 * 可以在页面布局中使用，也可以在 Modal 中展示
 */
export const RegisterShow: FC<RegisterShowProps> = ({
  loading,
  error,
  onSubmit,
  hideActions = false,
  onLoginClick,
  isModal = false,
  onClose,
}) => {
  const {t} = useTranslation();
  const [data, setData] = useState<RegisterData>({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });

  const content = (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        name="name"
        type="text"
        label={t('common.username')}
        variant="standard"
        required
        value={data?.name}
        onChange={(event: any) => {
          setData({...data, name: event.target.value});
        }}
      />
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
      <TextField
        name="password"
        type="password"
        label={t('common.password')}
        variant="standard"
        required
        value={data?.password}
        onChange={(event: any) => {
          setData({...data, password: event.target.value});
        }}
      />
      <TextField
        name="confirm"
        type="password"
        label={t('common.confirm')}
        variant="standard"
        required
        value={data?.confirm}
        onChange={(event: any) => {
          setData({...data, confirm: event.target.value});
        }}
      />
    </>
  );

  const actions = !hideActions && (
    <>
      <Button variant="text" type="button" onClick={onLoginClick}>
        {t('auth.login')}
      </Button>
      <Button
        type="button"
        variant="contained"
        disabled={loading}
        onClick={() => {
          onSubmit(data);
        }}
      >
        {loading ? 'Loading...' : t('auth.register')}
      </Button>
    </>
  );

  const LayoutComponent = isModal ? ModalLayout : Layout;

  return (
    <LayoutComponent
      title={t('auth.register')}
      content={content}
      actions={actions}
    />
  );
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RegisterPageProps {
  isModal?: boolean;
  onClose?: () => void;
}

/**
 * RegisterPage - 完整的注册页面容器
 * 包含状态管理和表单处理逻辑
 */
export const RegisterPage: FC<RegisterPageProps> = ({
  isModal = false,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  let hasError = false;
  const {t} = useTranslation();
  const {setUser} = useUserStore();

  const handleSubmit = async (data: RegisterData) => {
    setLoading(true);
    setError(undefined);
    try {
      const name = data?.name;
      if (!validateName(name))
        throw new Error(t('auth.error.invalid_username'));

      const email = data?.email;
      if (!validateEmail(email)) throw new Error(t('auth.error.invalid_email'));

      const password = data?.password;
      if (!validatePassword(password))
        throw new Error(t('auth.error.invalid_password'));

      const confirm = data?.confirm;
      if (!validatePassword(confirm))
        throw new Error(t('auth.error.invalid_confirm'));

      if (password !== confirm) {
        throw new Error(t('auth.error.passwords_mismatch'));
      }

      const result = await register(name, email, password);
      setUser(result?.user);
    } catch (e) {
      setError((e as Error).message);
      hasError = true;
    } finally {
      setLoading(false);
    }
    if (!hasError) {
      onClose?.();
    }
  };

  const handleLoginClick = () => {
    // TODO: Navigate to login page
    window.location.href = '/login';
  };

  return (
    <RegisterShow
      loading={loading}
      error={error}
      onSubmit={handleSubmit}
      onLoginClick={handleLoginClick}
      isModal={isModal}
      onClose={onClose}
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
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="!p-0">
        <RegisterPage isModal={true} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
