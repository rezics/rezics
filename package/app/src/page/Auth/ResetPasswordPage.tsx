import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import {Dialog, DialogContent} from '@mui/material';
import {type FC, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'wouter';

import {Turnstile} from '@/component/Form/Turnstile.tsx';
import {PasswordField} from '@/component/Form/PasswordField';
import {Layout} from './lib/Layout.tsx';
import {ModalLayout} from './lib/ModalLayout.tsx';
import {validateEmail, validatePassword} from './lib/validate.ts';
import {userApi} from '@/api/user/user';
import {
  GetVerificationCode,
  type GetVerificationCodeHandle,
} from './GetVerificationCode.tsx';

interface ResetPasswordData {
  email: string;
  password: string;
  confirm: string;
  verificationCode?: string;
}

export interface ResetPasswordPageProps {
  isModal?: boolean;
  onClose?: () => void;
}

/**
 * ResetPasswordPage - 完整的重置密码页面容器
 * 合并了原来的 Show/Page 结构，并复用 GetVerificationCode 组件
 */
export const ResetPasswordPage: FC<ResetPasswordPageProps> = ({
  isModal = false,
  onClose,
}) => {
  const {t} = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [data, setData] = useState<ResetPasswordData>({
    email: '',
    password: '',
    confirm: '',
  });
  const verificationRef = useRef<GetVerificationCodeHandle | null>(null);
  const [location, navigate] = useLocation();

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
        throw new Error('Passwords do not match.');
      }

      const verificationCode = data?.verificationCode;
      if (!verificationCode) {
        throw new Error('Verification code is required.');
      }

      await userApi.resetPassword({
        email,
        verificationCode,
        newPassword: password,
      });
    } catch (e) {
      setError((e as Error).message);
      hasError = true;
    } finally {
      setLoading(false);
    }

    if (!hasError) {
      onClose?.();
      if (location === '/reset-password') {
        navigate('/login');
      }
    }
  };

  const handleTurnstileVerify = async (token: string) => {
    if (!verificationRef.current) return;
    await verificationRef.current.handleTurnstileVerify(token);
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  const LayoutComponent = isModal ? ModalLayout : Layout;

  const content = (
    <>
      {showTurnstile && (
        <div
          style={{marginTop: '16px', display: 'flex', justifyContent: 'center'}}
        >
          <Turnstile onVerify={handleTurnstileVerify} />
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
    </>
  );

  const actions = (
    <>
      <Button variant="text" type="button" onClick={handleLoginClick}>
        {t('auth.login')}
      </Button>
      <Button
        type="button"
        variant="contained"
        disabled={loading}
        onClick={handleSubmit}
      >
        {loading ? 'Loading...' : 'Reset Password'}
      </Button>
    </>
  );

  return (
    <LayoutComponent
      title="Reset Password"
      content={content}
      actions={actions}
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
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="!p-0">
        <ResetPasswordPage isModal={true} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
