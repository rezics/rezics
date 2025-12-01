import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import {type FC, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {register} from './lib/handler.ts';
import {Layout} from './lib/Layout.tsx';
import {ModalLayout} from './lib/ModalLayout.tsx';
import {validateEmail, validateSlug, validatePassword} from './lib/validate.ts';
import {Dialog, DialogContent} from '@mui/material';
import {useUserStore} from '@/global/userStore.ts';
import {useLocation} from 'wouter';
import {Turnstile} from '@/component/Form/Turnstile.tsx';

export interface RegisterShowProps {
  loading: boolean;
  error?: string;
  onSubmit: (data: RegisterData) => void;
  hideActions?: boolean;
  onLoginClick?: () => void;
  isModal?: boolean;
}

interface RegisterData {
  slug: string;
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
}) => {
  const {t} = useTranslation();
  const [data, setData] = useState<RegisterData>({
    slug: '',
    email: '',
    password: '',
    confirm: '',
  });

  const content = (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      <Turnstile
        onVerify={token => {
          console.log(token);
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
        name="slug"
        type="text"
        label={t('common.username')}
        variant="standard"
        placeholder={t('auth.help.slug')}
        helperText={t('auth.help.slug_require')}
        required
        value={data?.slug}
        onChange={(event: any) => {
          setData({...data, slug: event.target.value});
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
      {/* <TextField
        name="name"
        type="text"
        label={t('common.nickname')}
        variant="standard"
        required
        value={data?.name}
        onChange={(event: any) => {
          setData({...data, name: event.target.value});
        }}
      /> */}
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
  const {setUser} = useUserStore();
  const [location, navigate] = useLocation();
  const handleSubmit = async (data: RegisterData) => {
    setLoading(true);
    setError(undefined);
    try {
      let validateData: {valid: boolean; error: string | null} = {
        valid: false,
        error: null,
      };
      const slug = data?.slug;
      validateData = validateSlug(slug);
      if (!validateData.valid) throw new Error(validateData.error ?? '');

      const email = data?.email;
      validateData = validateEmail(email);
      if (!validateData.valid) throw new Error(validateData.error ?? '');

      const password = data?.password;
      validateData = validatePassword(password);
      if (!validateData.valid) throw new Error(validateData.error ?? '');

      const confirm = data?.confirm;
      validateData = validatePassword(confirm);
      if (!validateData.valid) throw new Error(validateData.error ?? '');
      if (password !== confirm) throw new Error('Passwords do not match.');

      const result = await register(slug, email, password);
      setUser(result?.user);
    } catch (e) {
      setError((e as Error).message);
      hasError = true;
    } finally {
      setLoading(false);
    }
    if (!hasError) {
      onClose?.();
      if (location === '/register') {
        navigate('/');
      }
    }
  };

  const handleLoginClick = () => {
    // TODO: Navigate to login page
    navigate('/login');
  };

  return (
    <RegisterShow
      loading={loading}
      error={error}
      onSubmit={handleSubmit}
      onLoginClick={handleLoginClick}
      isModal={isModal}
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
