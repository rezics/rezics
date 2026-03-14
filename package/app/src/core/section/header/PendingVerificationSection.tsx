import {Button, Typography} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {Link} from '@tanstack/react-router';
import {useAuth} from '@/user/page/useAuth';
import {MoreHorizMenu} from '../../component/header/MoreHorizMenu';

export function PendingVerificationSection() {
  const {t} = useTranslation();
  const auth = useAuth();

  return (
    <div className="flex items-center gap-2">
      <div className="hidden md:flex flex-col items-end leading-tight">
        <Typography variant="body2" fontWeight={600}>
          {auth.authSession?.email ?? t('auth.flow.verify_title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {auth.needsVerification
            ? t('auth.flow.verify_guest_notice')
            : t('auth.flow.onboarding_title')}
        </Typography>
      </div>
      {auth.needsVerification ? (
        <Button
          variant="outlined"
          size="small"
          component={Link}
          to="/verify-email"
        >
          {t('auth.flow.verify_resend')}
        </Button>
      ) : (
        <Button
          variant="outlined"
          size="small"
          component={Link}
          to="/onboarding"
        >
          {t('common.continue')}
        </Button>
      )}
      <MoreHorizMenu />
    </div>
  );
}
