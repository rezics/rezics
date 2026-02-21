import React, {useMemo} from 'react';
import {UserContainer} from '../User.tsx';
import {useLayoutStore} from '../../state/layoutStore.ts';
import {AppBar, Avatar, Toolbar, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {cn} from '@/shared/util/css-util';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {useAppStore} from '@/app/state/appStore.ts';
import {MoreHorizMenu} from './MoreHorizMenu.tsx';
import {DrawerToggler} from './DrawerToggler.tsx';

interface HeaderProps {
  isDragging?: boolean;
  layoutType?: 'type-a' | 'type-b';
  disableDrawerToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isDragging = false,
  layoutType = 'type-b',
  disableDrawerToggle = false,
}) => {
  const {sidebarOpen, drawerWidth, toggleSidebar} = useLayoutStore();
  const theme = useTheme();

  const themeMode = useAppStore(state => state.theme);

  const isDark = useMemo(() => themeMode === 'dark', [themeMode]);

  function handleDrawerToggleInner() {
    if (disableDrawerToggle) return;
    toggleSidebar();
  }

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        zIndex: theme.zIndex.drawer + 1,
        ml: layoutType === 'type-a' ? (sidebarOpen ? drawerWidth : 0) : 0,
        width:
          layoutType === 'type-a'
            ? sidebarOpen
              ? `calc(100% - ${drawerWidth}px)`
              : '100%'
            : '100%',
        transition: theme.transitions.create(['margin', 'width'], {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}
      className={cn(
        isDragging ? 'rounded-tl-2xl rounded-bl-2xl' : '',
        'pointer-events-auto',
        'border-b',
        isDark ? 'border-gray-800' : 'border-gray-200',
      )}
    >
      <Toolbar>
        <DrawerToggler
          handleDrawerToggleInner={handleDrawerToggleInner}
          layoutType={layoutType}
          sidebarOpen={sidebarOpen}
        />
        <Typography variant="h6" noWrap component="div" sx={{flexGrow: 1}}>
          <Link to="/" className="flex items-center gap-2">
            <Avatar sx={{bgcolor: 'transparent'}} variant="rounded">
              <img src="/logo.svg" alt="logo" />
            </Avatar>
            <Typography
              variant="h1"
              className="text-2xl font-bold"
              sx={{color: 'primary.main'}}
            >
              REZICS
            </Typography>
          </Link>
        </Typography>
        <UserContainer onLogout={() => console.log('Logout')} />
        {/* 手机模式这里添加搜索按钮 */}
        <MoreHorizMenu />
      </Toolbar>
    </AppBar>
  );
};
