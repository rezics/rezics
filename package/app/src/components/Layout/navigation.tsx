import React from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import BarChartIcon from '@mui/icons-material/BarChart';
import DescriptionIcon from '@mui/icons-material/Description';
import LayersIcon from '@mui/icons-material/Layers';
import ErrorIcon from '@mui/icons-material/Error';
import PersonIcon from '@mui/icons-material/Person';
import LoginIcon from '@mui/icons-material/Login';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import BookIcon from '@mui/icons-material/Book';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';

export interface NavigationItem {
  kind: 'header' | 'divider' | 'item';
  title?: string;
  segment?: string;
  icon?: React.ReactNode;
  children?: NavigationItem[];
}

// segment: router path

export const NAVIGATION: NavigationItem[] = [
  {
    kind: 'header',
    title: 'Main items',
  },
  {
    kind: 'item',
    segment: '/',
    title: 'Home',
    icon: <DashboardIcon />,
  },
  {
    kind: 'item',
    segment: '/books',
    title: 'Books',
    icon: <BookIcon />,
  },
  {
    kind: 'item',
    segment: '/book',
    title: 'Book',
    icon: <LibraryBooksIcon />,
    children: [
      {
        kind: 'item',
        segment: '/book/1',
        title: 'Book 1',
        icon: <BookmarkBorderIcon />,
      },
      {
        kind: 'item',
        segment: '/booklist/1',
        title: 'Book List 1',
        icon: <FormatListBulletedIcon />,
      },
    ],
  },
  {
    kind: 'divider',
  },
  {
    kind: 'header',
    title: 'Analytics',
  },
  {
    kind: 'item',
    segment: '/auth',
    title: 'Auth',
    icon: <PersonIcon />,
    children: [
      {
        kind: 'item',
        segment: '/login',
        title: 'Login',
        icon: <LoginIcon />,
      },
      {
        kind: 'item',
        segment: '/register',
        title: 'Register',
        icon: <HowToRegIcon />,
      },
    ],
  },
  {
    kind: 'item',
    segment: '/reports',
    title: 'Reports',
    icon: <BarChartIcon />,
    children: [
      {
        kind: 'item',
        title: 'Sales',
        segment: '/sales',
        icon: <DescriptionIcon />,
      },
      {
        kind: 'item',
        title: 'Traffic',
        segment: '/traffic',
        icon: <DescriptionIcon />,
      },
    ],
  },
  {
    kind: 'item',
    segment: '/integrations',
    title: 'Integrations',
    icon: <LayersIcon />,
  },
  {
    kind: 'item',
    segment: '/test/404',
    title: '404',
    icon: <ErrorIcon />,
  }
]; 