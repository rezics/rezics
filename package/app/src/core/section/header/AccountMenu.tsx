import {useUserStore} from '@/user/state';
import {
  Logout as LogoutIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import {useNavigate} from '@tanstack/react-router';
import React, {useState} from 'react';
import {Link} from '@package/ui/primitive/link/Link.tsx';

import {logout} from '@/user/model/handler';
import {userQueries} from '@package/api/user/user.queries';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {MiscMenuItems} from '../../component/header/MiscMenuItems';
export type AccountMenuProps = {
  onLogout?: () => void;
};

export const AccountMenu: React.FC<AccountMenuProps> = ({onLogout}) => {
  const navigate = useNavigate();
  const {setUser} = useUserStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const {data: user} = useQuery(userQueries.me());
  const {t} = useTranslation();

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

  return (
    <>
      <IconButton
        onClick={handleMenuOpen}
        size="small"
        sx={{ml: 2}}
        aria-controls="menu-appbar"
        aria-haspopup="true"
      >
        <Avatar
          sx={{width: 36, height: 36}}
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
        onClose={handleMenuClose}
      >
        <MenuItem
          component={Link}
          to={`/user/me`}
          onClick={() => {
            handleMenuClose();
            handleProfile();
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
            handleMenuClose();
            handleSettings();
          }}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('navigation.settings')}</ListItemText>
        </MenuItem>
        <MiscMenuItems />
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('auth.logout')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
