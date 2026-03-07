import DashboardIcon from '@mui/icons-material/Dashboard';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';

export type AdminNavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  to: string;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: AdminNavItem[];
};

export type AdminNavEntry = AdminNavItem | AdminNavGroup;

export const adminNav = {
  drawerWidth: 260,
  items: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon fontSize="small" />,
      to: '/',
    },
    {
      id: 'users',
      label: 'Users',
      icon: <PeopleIcon fontSize="small" />,
      children: [
        {
          id: 'users.list',
          label: 'List',
          icon: <PeopleIcon fontSize="small" />,
          to: '/users',
        },
        {
          id: 'users.meili',
          label: 'Meili Search',
          icon: <PeopleIcon fontSize="small" />,
          to: '/users/meili',
        },
        {
          id: 'users.create',
          label: 'Create',
          icon: <PeopleIcon fontSize="small" />,
          to: '/users/create',
        },
      ],
    },
    {
      id: 'units',
      label: 'Units',
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: 'units.list',
          label: 'List',
          icon: <Inventory2Icon fontSize="small" />,
          to: '/units',
        },
        {
          id: 'units.meili',
          label: 'Meili Search',
          icon: <Inventory2Icon fontSize="small" />,
          to: '/units/meili',
        },
        {
          id: 'units.create',
          label: 'Create',
          icon: <Inventory2Icon fontSize="small" />,
          to: '/units/create',
        },
      ],
    },
    {
      id: 'books',
      label: 'Books',
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: 'books.list',
          label: 'List',
          icon: <Inventory2Icon fontSize="small" />,
          to: '/book',
        },
        {
          id: 'books.meili',
          label: 'Meili Search',
          icon: <Inventory2Icon fontSize="small" />,
          to: '/book/meili',
        },
        {
          id: 'books.create',
          label: 'Create',
          icon: <Inventory2Icon fontSize="small" />,
          to: '/book/create',
        },
      ],
    },
    {
      id: 'misc',
      label: 'Misc',
      icon: <StorageOutlinedIcon fontSize="small" />,
      children: [
        {
          id: 'misc.echokv',
          label: 'EchoKV',
          icon: <StorageOutlinedIcon fontSize="small" />,
          to: '/misc/echokv',
        },
        {
          id: 'misc.token',
          label: 'Token',
          icon: <KeyOutlinedIcon fontSize="small" />,
          to: '/token',
        },
      ],
    },
    {
      id: 'meili',
      label: 'Meili',
      icon: <ManageSearchOutlinedIcon fontSize="small" />,
      children: [
        {
          id: 'meili.search',
          label: 'Meili Search',
          to: '/meili',
          icon: <ManageSearchOutlinedIcon fontSize="small" />,
        },
      ],
    },
    {
      id: 'auth',
      label: 'Auth',
      icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
      children: [
        {
          id: 'auth.users',
          label: 'Users',
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: '/auth/users',
        },
        {
          id: 'auth.sessions',
          label: 'Sessions',
          icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
          to: '/auth/sessions',
        },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon fontSize="small" />,
      to: '/settings',
    },
  ] satisfies AdminNavEntry[],
};
