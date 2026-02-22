import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import {Dialog, DialogContent} from '@mui/material';
import {type FC, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {register} from '../model/handler.ts';
import {Layout} from '../layout/Layout.tsx';
import {ModalLayout} from '../layout/ModalLayout.tsx';
import {
  validateEmail,
  validateSlug,
  validatePassword,
} from '../model/validate.ts';
import {useUserStore} from '@/global/userStore.ts';
import {useNavigate, useRouterState} from '@tanstack/react-router';
import {Turnstile} from '@package/ui/composite/auth/Turnstile.tsx';
import {PasswordField} from '@package/ui/composite/form/field/PasswordField.tsx';
import {
  GetVerificationCode,
  type GetVerificationCodeHandle,
} from '../component/GetVerificationCode.tsx';
import {TextButton} from '@package/ui/primitive/button/TextButton.tsx';

interface RegisterData {
  slug: string;
  email: string;
  password: string;
  confirm: string;
  verificationCode?: string;
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
  const {t} = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [data, setData] = useState<RegisterData>({
    slug: '',
    email: '',
    password: '',
    confirm: '',
  });
  const verificationRef = useRef<GetVerificationCodeHandle | null>(null);
  const {setUser} = useUserStore();
  const navigate = useNavigate();
  const pathname = useRouterState({select: s => s.location.pathname});

  const handleSubmit = async () => {
    let hasError = false;
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

      const verificationCode = data?.verificationCode;
      if (!verificationCode) throw new Error('Verification code is required.');

      const result = await register(slug, email, password, verificationCode);
      setUser(result?.user);
    } catch (e) {
      setError((e as Error).message);
      hasError = true;
    } finally {
      setLoading(false);
    }
    if (!hasError) {
      onClose?.();
      if (pathname === '/register') {
        navigate({to: '/'});
      }
    }
  };

  const handleTurnstileVerify = async (token: string) => {
    if (!verificationRef.current) return;
    await verificationRef.current.handleTurnstileVerify(token);
  };

  const handleLoginClickInternal = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      navigate({to: '/login'});
      onClose?.();
    }
  };

  function handleTurnstileError(error: Error) {
    setError(error.message);
  }

  const LayoutComponent = isModal ? ModalLayout : Layout;

  const content = (
    <>
      {showTurnstile && (
        <div
          style={{marginTop: '16px', display: 'flex', justifyContent: 'center'}}
        >
          <Turnstile
            onVerify={handleTurnstileVerify}
            onError={handleTurnstileError}
          />
        </div>
      )}
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
      <PasswordField
        value={data?.password}
        setValue={(value: string) => {
          setData({...data, password: value});
        }}
      />
      <PasswordField
        value={data?.confirm}
        setValue={(value: string) => {
          setData({...data, confirm: value});
        }}
      />
      <GetVerificationCode
        data={data}
        setData={setData}
        setShowTurnstile={setShowTurnstile}
        setError={setError}
        ref={verificationRef}
      />
      <div>
        Already have an account?&nbsp;
        <TextButton onClick={handleLoginClickInternal}>Sign in →</TextButton>
      </div>
    </>
  );

  const actions = (
    <>
      {/* <Button variant="text" type="button" onClick={handleLoginClickInternal}>
        {t('auth.login')}
      </Button> */}
      <Button
        type="button"
        variant="contained"
        disabled={loading}
        onClick={handleSubmit}
      >
        {loading ? 'Loading...' : t('auth.register')}
      </Button>
    </>
  );

  return (
    <LayoutComponent
      title={t('auth.register')}
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
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="!p-0">
        <RegisterPage isModal={true} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
