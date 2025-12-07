import {LangToggle} from '@/component/Layout/LangToggle.tsx';
import {UserContainer} from '@/component/Layout/User.tsx';
import {ThemeQuickToggle} from '@/component/Theme/ThemeCustomizer.tsx';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';
import {Brightness4, Brightness7, Menu} from '@mui/icons-material';
import {AppBar, IconButton, Toolbar, Typography} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import React from 'react';
import {useTranslation} from 'react-i18next';
// import clsx from 'clsx';

interface HeaderProps {
  handleDrawerToggle: () => void;
  mode: 'light' | 'dark';
  onThemeToggle: () => void;
  drawerWidth: number;
  isDragging?: boolean;
  layoutType?: 'type-a' | 'type-b';
  disableDrawerToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  handleDrawerToggle,
  mode,
  onThemeToggle,
  drawerWidth,
  isDragging = false,
  layoutType = 'type-a',
  disableDrawerToggle = false,
}) => {
  const {sidebarOpen} = useLayoutStore();
  const theme = useTheme();
  const {t} = useTranslation();

  function handleDrawerToggleInner() {
    if (disableDrawerToggle) return;
    handleDrawerToggle();
  }
  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: theme => theme.zIndex.drawer + 1,
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
      className={isDragging ? 'rounded-tl-2xl rounded-bl-2xl' : ''}
    >
      <Toolbar>
        <IconButton
          color="inherit"
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
          REZICS
        </Typography>
        <ThemeQuickToggle />
        <LangToggle />
        <IconButton color="inherit" onClick={onThemeToggle}>
          {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
        <UserContainer onLogout={() => console.log('Logout')} />
      </Toolbar>
    </AppBar>
  );
};
