// NAVIGATION.tsx
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';

import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';

import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import LooksOneOutlinedIcon from '@mui/icons-material/LooksOneOutlined';
import LooksTwoOutlinedIcon from '@mui/icons-material/LooksTwoOutlined';
import Looks3OutlinedIcon from '@mui/icons-material/Looks3Outlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';

import type {NavigationItem} from './navigation';

// segment: router path
export const NAVIGATION = (isAdmin = false): NavigationItem[] => {
  const common: NavigationItem[] = [
    {
      kind: 'item',
      segment: '/',
      title: 'Home',
      icon: DashboardOutlinedIcon,
    },
    {
      kind: 'item',
      segment: '/user/me',
      title: 'My',
      onlyMobile: true,
      icon: AccountCircleOutlinedIcon,
    },
    {
      kind: 'item',
      segment: '/book',
      title: 'Books',
      icon: MenuBookOutlinedIcon,
    },
    {
      kind: 'item',
      segment: '/readlist',
      title: 'Read Lists',
      icon: ListAltOutlinedIcon,
    },
    {
      kind: 'item',
      segment: '/review',
      title: 'Reviews',
      icon: RateReviewOutlinedIcon,
    },
    {
      kind: 'item',
      segment: '/unit',
      title: 'Units',
      icon: ArticleOutlinedIcon,
    },
    {
      kind: 'item',
      segment: '/notice',
      title: 'Notice',
      onlyMobile: true,
      icon: NotificationsOutlinedIcon,
    },

    {kind: 'divider'},
    {
      kind: 'item',
      segment: '/book/new',
      title: 'New Book',
      icon: PostAddOutlinedIcon,
    },
    {
      kind: 'item',
      title: 'New Read List',
      segment: '/readlist/new',
      icon: PlaylistAddOutlinedIcon,
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
          icon: StorageOutlinedIcon,
        },
        {
          kind: 'item',
          segment: '/token',
          title: 'Token',
          icon: KeyOutlinedIcon,
        },

        {kind: 'divider'},
        {
          kind: 'item',
          segment: '/auth',
          title: 'User',
          icon: ManageAccountsOutlinedIcon,
          children: [
            {
              kind: 'item',
              segment: '/login',
              title: 'Login',
              icon: LoginOutlinedIcon,
            },
            {
              kind: 'item',
              segment: '/register',
              title: 'Register',
              icon: HowToRegOutlinedIcon,
            },
          ],
        },

        {kind: 'divider'},
        {
          kind: 'item',
          segment: '/meili',
          title: 'Meili Search',
          icon: ManageSearchOutlinedIcon,
        },

        {kind: 'divider'},
        {
          kind: 'item',
          segment: '/feedback',
          title: 'Feedback',
          icon: FeedbackOutlinedIcon,
        },
        {
          kind: 'item',
          segment: '/feedback/admin',
          title: 'Feedback Admin',
          icon: SupportAgentOutlinedIcon,
        },

        {kind: 'divider'},
        {
          kind: 'item',
          segment: '/theme-switch',
          title: 'Theme Switch',
          icon: PaletteOutlinedIcon,
        },
        {
          kind: 'item',
          segment: '/test',
          title: 'Test Suite',
          icon: ScienceOutlinedIcon,
          children: [
            {
              kind: 'item',
              segment: '/test',
              title: 'Test 01',
              icon: LooksOneOutlinedIcon,
            },
            {
              kind: 'item',
              segment: '/test02',
              title: 'Test 02',
              icon: LooksTwoOutlinedIcon,
            },
            {
              kind: 'item',
              segment: '/test03',
              title: 'Test 03',
              icon: Looks3OutlinedIcon,
            },
          ],
        },
        {
          kind: 'item',
          segment: '/test/404',
          title: '404 Page',
          icon: ErrorOutlineOutlinedIcon,
        },
      ];

  return [...common, ...admin];
};
