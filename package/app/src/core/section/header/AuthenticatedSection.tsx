import {AccountMenu} from './AccountMenu.tsx';
import {CreateMenu} from '../../component/create-menu/CreateMenu.tsx';
import NotificationsIcon from '@mui/icons-material/Notifications';
import {IconButton} from '@mui/material';
import {Link} from '@package/ui/primitive/link/Link.tsx';

export function AuthenticatedSection() {
  return (
    <div className="flex items-center gap-2">
      <Link to="/inbox/notification">
        <IconButton>
          <NotificationsIcon />
        </IconButton>
      </Link>
      <CreateMenu />
      <AccountMenu onLogout={() => console.log('Logout')} />
    </div>
  );
}
