import React, {useMemo} from 'react';
import {LangToggle} from '../LangToggle.tsx';
import {UserContainer} from '../User.tsx';
import {useLayoutStore} from '../../state/layoutStore.ts';
import {Brightness4, Brightness7, Menu} from '@mui/icons-material';
import {AppBar, Avatar, IconButton, Toolbar, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {useTranslation} from 'react-i18next';
import {cn} from '@/shared/util/cssUtil';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {useAppStore} from '@/global/appStore.ts';

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
  const {t} = useTranslation();

  const themeMode = useAppStore(state => state.theme);
  const setTheme = useAppStore(state => state.setTheme);

  const isDark = useMemo(() => themeMode === 'dark', [themeMode]);

  const toggleTheme = () => {
    setTheme(themeMode === 'light' ? 'dark' : 'light');
  };

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
        <IconButton
          aria-label={t('accessibility.open_drawer')}
          onClick={handleDrawerToggleInner}
          edge="start"
          sx={{
            mr: 2,
            display:
              layoutType == 'type-b' ? 'flex' : sidebarOpen ? 'none' : 'flex',
          }}
        >
          <Menu />
        </IconButton>
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
        {/* <ThemeQuickToggle /> */}
        <LangToggle />
        <IconButton onClick={toggleTheme}>
          {themeMode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
        <UserContainer onLogout={() => console.log('Logout')} />
      </Toolbar>
    </AppBar>
  );
};
