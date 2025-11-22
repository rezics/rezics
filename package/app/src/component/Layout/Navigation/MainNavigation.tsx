import BarChartIcon from '@mui/icons-material/BarChart';
import BookIcon from '@mui/icons-material/Book';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import ErrorIcon from '@mui/icons-material/Error';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import LayersIcon from '@mui/icons-material/Layers';
import LoginIcon from '@mui/icons-material/Login';
import PersonIcon from '@mui/icons-material/Person';

import type {NavigationItem} from './navigation.d.ts';

// segment: router path

export const NAVIGATION = (): NavigationItem[] => [
  {
    kind: 'header',
    title: 'Main Items',
  },
  {
    kind: 'item',
    segment: '/',
    title: 'Home',
    icon: <DashboardIcon />,
  },
  {
    kind: 'item',
    segment: '/book',
    title: 'Books',
    icon: <BookIcon />,
  },

  {
    kind: 'item',
    segment: '/readlist/',
    title: 'Read Lists',
    icon: <FormatListBulletedIcon />,
  },
  {
    kind: 'item',
    segment: '/review/',
    title: 'Review Lists',
    icon: <BookIcon />,
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
    segment: '/book/1/edit',
    title: 'Book Edit',
    icon: <BarChartIcon />,
    children: [
      {
        kind: 'item',
        title: 'Add New Book',
        segment: '/book/new',
        icon: <DescriptionIcon />,
      },
      {
        kind: 'item',
        title: 'Book Edit Chapter',
        segment: '/book/1/edit/1',
        icon: <DescriptionIcon />,
      },
      {
        kind: 'item',
        title: 'Read List New',
        segment: '/readlist/new',
        icon: <FormatListBulletedIcon />,
      },
      {
        kind: 'item',
        title: 'Review New',
        segment: '/review/new',
        icon: <BookIcon />,
      },
    ],
  },
  {
    kind: 'item',
    segment: '/test',
    title: 'Test',
    icon: <LayersIcon />,
    children: [
      {
        kind: 'item',
        segment: '/test',
        title: 'Test 01',
        icon: <LayersIcon />,
      },
      {
        kind: 'item',
        segment: '/test02',
        title: 'Test 02',
        icon: <LayersIcon />,
      },
      {
        kind: 'item',
        segment: '/test03',
        title: 'Test 03',
        icon: <LayersIcon />,
      },
    ],
  },
  {
    kind: 'item',
    segment: '/test/404',
    title: '404',
    icon: <ErrorIcon />,
  },
];
