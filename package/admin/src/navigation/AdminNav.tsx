import {
  Box,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { getToken, parseJwt } from "@rezics/api/react-query/jwt";
import { NormalizedTokenName } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useRouterState } from "@tanstack/react-router";
import React from "react";
import { adminConfig } from "@/app/config/adminConfig";

import type {
  AdminNavEntry,
  AdminNavGroup,
  AdminNavItem,
} from "./adminNavConfig";
import { ChevronUp as ExpandLessIcon, ChevronDown as ExpandMoreIcon } from "lucide-react";

function isGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return "children" in entry;
}

function isItem(entry: AdminNavEntry): entry is AdminNavItem {
  return "to" in entry;
}

function isActivePath(pathname: string, to: string) {
  if (to === "/_admin/" || to === "/_admin") {
    return pathname === "/_admin" || pathname === "/_admin/";
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

function getCurrentUserRole(): string | null {
  const token = getToken(NormalizedTokenName.AUTH_SESSION);
  if (!token) return null;
  return parseJwt(token)?.role ?? null;
}

function isItemVisible(item: AdminNavItem): boolean {
  if (!item.requiredRole) return true;
  return getCurrentUserRole() === item.requiredRole;
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

  const renderItem = (
    item: AdminNavItem,
    depth: number,
    siblings?: AdminNavItem[],
  ) => {
    let selected = isActivePath(pathname, item.to);

    // Avoid the "List" item being selected when a more specific sibling route is active.
    // Example: `/user` matches `/user/create` by prefix, but only `Create` should be selected.
    if (selected && siblings?.length) {
      const hasMoreSpecificActiveSibling = siblings.some(
        (s) =>
          s.id !== item.id &&
          s.to.startsWith(`${item.to}/`) &&
          isActivePath(pathname, s.to),
      );
      if (hasMoreSpecificActiveSibling) selected = false;
    }

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
    <Box
      sx={{
        marginTop: 8,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {adminConfig.appName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          env: {adminConfig.env}
        </Typography>
      </Box>
      <Divider />

      <List
        dense
        sx={{ py: 1, display: "flex", flexDirection: "column", gap: 0.5 }}
      >
        {items.map((entry) => {
          if (isItem(entry)) {
            if (!isItemVisible(entry)) return null;
            return renderItem(entry, 0);
          }
          if (!isGroup(entry)) return null;

          const visibleChildren = entry.children.filter(isItemVisible);
          if (visibleChildren.length === 0) return null;

          const open = !!openGroups[entry.id];
          const anySelected = visibleChildren.some((child) =>
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
                  {visibleChildren.map((child) =>
                    renderItem(child, 1, visibleChildren),
                  )}
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
