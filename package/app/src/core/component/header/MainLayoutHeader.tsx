import React, {useMemo} from 'react';
import {useLayoutStore} from '../../state/layoutStore.ts';
import {AppBar, Avatar, Toolbar, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {cn} from '@/shared/util/css-util';
import {Link} from '@rezics/ui/primitive/link/Link.tsx';
import {useAppStore} from '@/app/state/appStore.ts';
import {DrawerToggler} from './DrawerToggler.tsx';
import {HomeSearch} from '@/search';
import {useIsMobile} from '@/shared/util/use-media-query';
import {useMatch} from '@tanstack/react-router';
import {Route as HomeRoute} from '@/routes/_mainLayout/index.tsx';
import {AuthenticatedSection} from '@/core/section/header/AuthenticatedSection.tsx';
import {PendingVerificationSection} from '@/core/section/header/PendingVerificationSection.tsx';
import {UnauthenticatedSection} from '@/core/section/header/UnauthenticatedSection.tsx';
import {useAuth} from '@/user/page/useAuth';

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

  const handleDrawerToggle = () => {
    if (!disableDrawerToggle) toggleSidebar();
  };

  const auth = useAuth();

  const authSection = (() => {
    if (auth.readyForApp && auth.user) return <AuthenticatedSection />;
    if (auth.authenticated) return <PendingVerificationSection />;
    return <UnauthenticatedSection />;
  })();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        zIndex: theme.zIndex.drawer + 1,
        ml: layoutType === 'type-a' && sidebarOpen ? drawerWidth : 0,
        width:
          layoutType === 'type-a' && sidebarOpen
            ? `calc(100% - ${drawerWidth}px)`
            : '100%',
        transition: theme.transitions.create(['margin', 'width'], {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
      }}
      className={cn(
        isDragging && 'rounded-tl-2xl rounded-bl-2xl',
        'pointer-events-auto',
        'border-b',
        isDark ? 'border-gray-800' : 'border-gray-200',
      )}
    >
      <Toolbar className="px-2 gap-2">
        <DrawerToggler
          handleDrawerToggleInner={handleDrawerToggle}
          layoutType={layoutType}
          sidebarOpen={sidebarOpen}
        />

        <Link to="/" className="flex items-center gap-2 shrink-0">
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

        <div className="flex-1 min-w-0 flex justify-center">
          {!isMobile && matchHomeRoute && (
            <HomeSearch className="w-full max-w-md" />
          )}
        </div>

        {authSection}
      </Toolbar>
    </AppBar>
  );
};
