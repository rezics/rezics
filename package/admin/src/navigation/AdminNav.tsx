import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import React from 'react';
import { useRouterState } from '@tanstack/react-router';

import { adminConfig } from '@/config/adminConfig';
import { Link } from '@package/ui/Navigation/Link.tsx';

import type { AdminNavEntry, AdminNavGroup, AdminNavItem } from './adminNavConfig';

function isGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return 'children' in entry;
}

function isItem(entry: AdminNavEntry): entry is AdminNavItem {
  return 'to' in entry;
}

function isActivePath(pathname: string, to: string) {
  if (to === '/_admin/' || to === '/_admin') {
    return pathname === '/_admin' || pathname === '/_admin/';
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AdminNav({
  items,
  onNavigate,
}: {
  items: AdminNavEntry[];
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const initialOpenGroups = React.useMemo(() => {
    const open: Record<string, boolean> = {};
    for (const entry of items) {
      if (isGroup(entry)) {
        open[entry.id] = entry.children.some((child) =>
          isActivePath(pathname, child.to),
        );
      }
    }
    return open;
  }, [items, pathname]);

  const [openGroups, setOpenGroups] =
    React.useState<Record<string, boolean>>(initialOpenGroups);

  React.useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const entry of items) {
        if (isGroup(entry)) {
          const shouldOpen = entry.children.some((child) =>
            isActivePath(pathname, child.to),
          );
          if (next[entry.id] !== shouldOpen) {
            next[entry.id] = shouldOpen;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [items, pathname]);

  const renderItem = (item: AdminNavItem, depth: number) => {
    const selected = isActivePath(pathname, item.to);
    return (
      <ListItemButton
        key={item.id}
        component={Link}
        to={item.to}
        selected={selected}
        onClick={onNavigate}
        sx={{
          pl: depth === 0 ? 1.5 : 4,
          py: 0.75,
          borderRadius: 1,
          mx: 1,
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} />
      </ListItemButton>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {adminConfig.appName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          env: {adminConfig.env}
        </Typography>
      </Box>
      <Divider />

      <List dense sx={{ py: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {items.map((entry) => {
          if (isItem(entry)) return renderItem(entry, 0);
          if (!isGroup(entry)) return null;

          const open = !!openGroups[entry.id];
          const anySelected = entry.children.some((child) =>
            isActivePath(pathname, child.to),
          );

          return (
            <Box key={entry.id}>
              <ListItemButton
                onClick={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    [entry.id]: !prev[entry.id],
                  }))
                }
                selected={anySelected}
                sx={{
                  pl: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  mx: 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{entry.icon}</ListItemIcon>
                <ListItemText primary={entry.label} />
                {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </ListItemButton>
              <Collapse in={open} timeout="auto" unmountOnExit>
                <List dense sx={{ py: 0.5 }}>
                  {entry.children.map((child) => renderItem(child, 1))}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </List>

      <Box sx={{ flex: 1 }} />
      <Divider />
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          REZICS Book Library
        </Typography>
      </Box>
    </Box>
  );
}

