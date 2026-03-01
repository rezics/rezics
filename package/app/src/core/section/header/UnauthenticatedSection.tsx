import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useIsMobile} from '@/shared/util/use-media-query';
import {Button} from '@mui/material';
import {Link} from '@tanstack/react-router';
import {MoreHorizMenu} from '../../component/header/MoreHorizMenu';
import {LoginModal} from '@/user/page/LoginPage';
import {RegisterModal} from '@/user/page/RegisterPage';

const LoginPrompt = () => {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const {t} = useTranslation();

  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Button variant="text" component={Link} to="/login">
        {t('auth.login')}
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="text" onClick={() => setLoginModalOpen(true)}>
        {t('auth.login')}
      </Button>
      <Button variant="outlined" onClick={() => setRegisterModalOpen(true)}>
        {t('auth.register')}
      </Button>

      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />
      <RegisterModal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
      />
    </div>
  );
};

export function UnauthenticatedSection() {
  return (
    <>
      <LoginPrompt />
      <MoreHorizMenu />
    </>
  );
}
