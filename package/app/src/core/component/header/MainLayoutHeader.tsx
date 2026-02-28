import React, {useMemo} from 'react';
import {UserContainer} from '../User.tsx';
import {useLayoutStore} from '../../state/layoutStore.ts';
import {AppBar, Avatar, Toolbar, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {cn} from '@/shared/util/css-util';
import {Link} from '@package/ui/primitive/link/Link.tsx';
import {useAppStore} from '@/app/state/appStore.ts';
import {MoreHorizMenu} from './MoreHorizMenu.tsx';
import {DrawerToggler} from './DrawerToggler.tsx';
import {HomeSearch} from '@/search';
import {useIsMobile} from '@/shared/util/use-media-query';
import {useMatch} from '@tanstack/react-router';
import {Route as HomeRoute} from '@/routes/_mainLayout/index.tsx';
import {useUserStore} from '@/global/userStore';
import {CreateMenu} from '../create-menu/CreateMenu.tsx';

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
  const isMobile = useIsMobile();
  const themeMode = useAppStore(state => state.theme);

  const isDark = useMemo(() => themeMode === 'dark', [themeMode]);
  const matchHomeRoute = useMatch({from: HomeRoute.id, shouldThrow: false});
  function handleDrawerToggleInner() {
    if (disableDrawerToggle) return;
    toggleSidebar();
  }

  const currentUser = useUserStore(state => state.user);

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
      <Toolbar disableGutters>
        <DrawerToggler
          handleDrawerToggleInner={handleDrawerToggleInner}
          layoutType={layoutType}
          sidebarOpen={sidebarOpen}
        />
        <div className="flex items-center min-w-0 h-full">
          <Typography variant="h6" noWrap component="div" sx={{mr: 1}}>
            <Link to="/" className="flex items-center gap-2">
              {!matchHomeRoute && (
                <Avatar sx={{bgcolor: 'transparent'}} variant="rounded">
                  <img src="/logo.svg" alt="logo" />
                </Avatar>
              )}
              <Typography
                variant="h1"
                className="text-3xl font-bold"
                sx={{color: 'primary.main'}}
              >
                REZICS
              </Typography>
            </Link>
          </Typography>
        </div>
        <div className="flex-1 min-w-0 flex justify-center">
          {!isMobile && matchHomeRoute && (
            <HomeSearch className="w-full max-w-md" />
          )}
        </div>
        {currentUser && <CreateMenu />}
        <UserContainer onLogout={() => console.log('Logout')} />
        {!currentUser && <MoreHorizMenu />}
      </Toolbar>
    </AppBar>
  );
};
