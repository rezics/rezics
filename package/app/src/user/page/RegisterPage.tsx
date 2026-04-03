import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import {Dialog, DialogContent} from '@mui/material';
import {type FC, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {register} from '../model/handler.ts';
import {Layout} from '../layout/Layout.tsx';
import {ModalLayout} from '../layout/ModalLayout.tsx';
import {validateEmail, validatePassword} from '../model/validate.ts';
import {useNavigate, useRouterState} from '@tanstack/react-router';
import {PasswordField} from '@rezics/ui/composite/form/field/PasswordField.tsx';
import {TextButton} from '@rezics/ui/primitive/button/TextButton.tsx';
import {useAuthSessionStore} from '@/user/state';
import {SocialAuthButtons} from '../component/SocialAuthButtons';
import {resolvePostAuthDestination} from '../model/authRedirect';

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
  const {t} = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [data, setData] = useState<RegisterData>({
    email: '',
    password: '',
    confirm: '',
  });
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
      const email = data?.email;
      validateData = validateEmail(email);
      if (!validateData.valid) throw new Error(validateData.error ?? '');

      const password = data?.password;
      validateData = validatePassword(password);
      if (!validateData.valid) throw new Error(validateData.error ?? '');

      const confirm = data?.confirm;
      validateData = validatePassword(confirm);
      if (!validateData.valid) throw new Error(validateData.error ?? '');
      if (password !== confirm) {
        throw new Error(t('auth.error.passwords_mismatch'));
      }

      await register(email, password);
    } catch (e) {
      setError((e as Error).message);
      hasError = true;
    } finally {
      setLoading(false);
    }
    if (!hasError) {
      onClose?.();
      if (pathname === '/register') {
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

  const handleLoginClickInternal = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      navigate({to: '/login'});
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
      <PasswordField
        value={data?.confirm}
        setValue={(value: string) => {
          setData({...data, confirm: value});
        }}
      />
      <div>
        {t('auth.flow.already_have_account')}&nbsp;
        <TextButton onClick={handleLoginClickInternal}>
          {t('auth.flow.sign_in_instead')}
        </TextButton>
      </div>
      <SocialAuthButtons mode="register" />
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
        {loading ? t('common.loading') : t('auth.register')}
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
