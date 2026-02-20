import {useUserStore} from '@/global/userStore.ts';
import {
  Logout as LogoutIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import {useNavigate} from '@tanstack/react-router';
import React, {useState} from 'react';
import {Link} from '@package/ui/Navigation/Link.tsx';

import {LoginModal} from '@/user/page/LoginPage';
import {RegisterModal} from '@/user/page/RegisterPage';
import {logout} from '@/user/model/handler';
import {userQueries} from '@package/api/user/user.queries';
import {useQuery} from '@tanstack/react-query';
import {useIsMobile} from '@/shared/util/use-media-query';
import {useTranslation} from 'react-i18next';

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

export type UserShowProps = {
  anchorEl: HTMLElement | null;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: () => void;
  onLogout: () => void;
  onProfile?: () => void;
  onSettings?: () => void;
};

export const UserShow: React.FC<UserShowProps> = ({
  anchorEl,
  onMenuOpen,
  onMenuClose,
  onLogout,
  onProfile,
  onSettings,
}) => {
  const {data: user} = useQuery(userQueries.me());
  const {t} = useTranslation();
  return (
    <>
      <IconButton
        onClick={onMenuOpen}
        size="small"
        sx={{ml: 2}}
        aria-controls="menu-appbar"
        aria-haspopup="true"
      >
        <Avatar
          sx={{width: 32, height: 32}}
          variant="rounded"
          src={user?.avatar}
        >
          {user?.name?.charAt(0).toUpperCase()}
        </Avatar>
      </IconButton>
      <Menu
        id="menu-appbar"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorEl)}
        onClose={onMenuClose}
      >
        <MenuItem
          component={Link}
          to={`/user/me`}
          onClick={() => {
            onMenuClose();
            onProfile?.();
          }}
        >
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('navigation.profile')}</ListItemText>
        </MenuItem>
        <MenuItem
          component={Link}
          to={`/user/me/edit`}
          onClick={() => {
            onMenuClose();
            onSettings?.();
          }}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('navigation.settings')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={onLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('auth.logout')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export type UserContainerProps = {
  onLogout?: () => void;
};

export const UserContainer: React.FC<UserContainerProps> = ({onLogout}) => {
  const navigate = useNavigate();
  const {setUser} = useUserStore();
  const user = useUserStore(state => state.user);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    onLogout?.();
    setUser(null);
    navigate({to: '/login'});
    logout();
  };

  const handleProfile = () => {
    console.log('Profile clicked');
  };

  const handleSettings = () => {
    console.log('Settings clicked');
  };

  if (!user) {
    return <LoginPrompt />;
  }

  return (
    <UserShow
      anchorEl={anchorEl}
      onMenuOpen={handleMenuOpen}
      onMenuClose={handleMenuClose}
      onLogout={handleLogout}
      onProfile={handleProfile}
      onSettings={handleSettings}
    />
  );
};
