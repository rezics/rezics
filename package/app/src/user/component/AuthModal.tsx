import {Dialog, DialogContent} from '@mui/material';
import {type FC, useState} from 'react';
import {LoginPage} from './LoginPage.tsx';
import {RegisterPage} from './RegisterPage.tsx';

export interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

/**
 * AuthModal - 认证模态框组件
 * 可以在登录和注册之间切换
 */
export const AuthModal: FC<AuthModalProps> = ({
  open,
  onClose,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  const switchToRegister = () => setMode('register');
  const switchToLogin = () => setMode('login');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent className="p-0">
        {mode === 'login' ? (
          <LoginPage
            isModal={true}
            onClose={onClose}
            onRegisterClick={switchToRegister}
          />
        ) : (
          <RegisterPage
            isModal={true}
            onClose={onClose}
            onLoginClick={switchToLogin}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
