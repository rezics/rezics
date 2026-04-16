import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EmailIcon from '@mui/icons-material/Email';
import SecurityIcon from '@mui/icons-material/Security';
import LinkIcon from '@mui/icons-material/Link';
import KeyIcon from '@mui/icons-material/Key';
import TuneIcon from '@mui/icons-material/Tune';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { FC } from 'react';

const SETTINGS_NAV = [
  { label: 'Profile', path: 'profile', icon: AccountCircleIcon },
  { label: 'Account', path: 'account', icon: EmailIcon },
  { label: 'Security', path: 'security', icon: SecurityIcon },
  { label: 'Connected Accounts', path: 'connections', icon: LinkIcon },
  { label: 'API Tokens', path: 'tokens', icon: KeyIcon },
  { label: 'Preferences', path: 'preferences', icon: TuneIcon },
] as const;

export const SettingsSidebar: FC = () => {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const pathname = location.pathname;

  return (
    <List disablePadding>
      {SETTINGS_NAV.map(({ label, path, icon: Icon }) => {
        const fullPath = `/user/me/settings/${path}`;
        const isActive = pathname.startsWith(fullPath);

        return (
          <ListItemButton
            key={path}
            selected={isActive}
            onClick={() => void navigate({ to: fullPath })}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&.Mui-selected': {
                backgroundColor: 'action.selected',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
};

export { SETTINGS_NAV };
