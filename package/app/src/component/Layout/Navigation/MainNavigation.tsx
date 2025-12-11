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

import type {NavigationItem} from './navigation';

// segment: router path

export const NAVIGATION = (isAdmin = false): NavigationItem[] => {
  const common: NavigationItem[] = [
    {
      kind: 'header',
      title: 'Main',
    },
    {
      kind: 'item',
      segment: '/',
      title: 'Home',
      icon: <DashboardIcon />,
    },
    {
      kind: 'item',
      segment: '/user/me',
      title: 'My',
      onlyMobile: true,
      icon: <PersonIcon />,
    },
    {
      kind: 'item',
      segment: '/book',
      title: 'Books',
      icon: <BookIcon />,
    },
    {
      kind: 'item',
      segment: '/readlist',
      title: 'Read Lists',
      icon: <FormatListBulletedIcon />,
    },
    {
      kind: 'item',
      segment: '/review',
      title: 'Reviews',
      icon: <BookIcon />,
    },
    {
      kind: 'item',
      segment: '/unit',
      title: 'Units',
      icon: <DescriptionIcon />,
    },

    {kind: 'divider'},

    {
      kind: 'header',
      title: 'Management',
    },
    {
      kind: 'item',
      segment: '/book/new',
      title: 'New Book',
      icon: <DescriptionIcon />,
    },
    {
      kind: 'item',
      title: 'New Read List',
      segment: '/readlist/new',
      icon: <FormatListBulletedIcon />,
    },
  ];

  const admin: NavigationItem[] = !isAdmin
    ? []
    : [
        {kind: 'divider'},

        {
          kind: 'item',
          segment: '/misc/echokv',
          title: 'EchoKV',
          icon: <DescriptionIcon />,
        },
        {
          kind: 'item',
          segment: '/token',
          title: 'Token',
          icon: <DescriptionIcon />,
        },
        {kind: 'divider'},

        {
          kind: 'header',
          title: 'Auth',
        },
        {
          kind: 'item',
          segment: '/auth',
          title: 'User',
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

        {kind: 'divider'},

        {
          kind: 'header',
          title: 'System / Analytics',
        },
        {
          kind: 'item',
          segment: '/meili',
          title: 'Meili Search',
          icon: <DescriptionIcon />,
        },

        {kind: 'divider'},
        {
          kind: 'item',
          segment: '/feedback',
          title: 'Feedback',
          icon: <DescriptionIcon />,
        },
        {
          kind: 'item',
          segment: '/feedback/admin',
          title: 'Feedback Admin',
          icon: <DescriptionIcon />,
        },

        {kind: 'divider'},

        {
          kind: 'header',
          title: 'Developer Tools',
        },
        {
          kind: 'item',
          segment: '/theme-switch',
          title: 'Theme Switch',
          icon: <DescriptionIcon />,
        },
        {
          kind: 'item',
          segment: '/test',
          title: 'Test Suite',
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
          title: '404 Page',
          icon: <ErrorIcon />,
        },
      ];

  return [...common, ...admin];
};
