import {AccountMenu} from './AccountMenu.tsx';
import {CreateMenu} from '../../component/create-menu/CreateMenu.tsx';
import NotificationsIcon from '@mui/icons-material/Notifications';
import {IconButton} from '@mui/material';

export function AuthenticatedSection() {
  return (
    <div className="flex items-center gap-2">
      <IconButton>
        <NotificationsIcon />
      </IconButton>
      <CreateMenu />
      <AccountMenu onLogout={() => console.log('Logout')} />
    </div>
  );
}
