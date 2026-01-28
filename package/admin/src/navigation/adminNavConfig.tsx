import DashboardIcon from '@mui/icons-material/Dashboard';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import React from 'react';

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
      id: 'manage',
      label: 'Manage',
      icon: <Inventory2Icon fontSize="small" />,
      children: [
        {
          id: 'books',
          label: 'Books',
          icon: <Inventory2Icon fontSize="small" />,
          to: '/books',
        },
        {
          id: 'units',
          label: 'Units',
          icon: <Inventory2Icon fontSize="small" />,
          to: '/units',
        },
        {
          id: 'users',
          label: 'Users',
          icon: <PeopleIcon fontSize="small" />,
          to: '/users',
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

