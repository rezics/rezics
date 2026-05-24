import { useAuthSessionStore } from "@rezics/api/states";
import { Separator } from "@rezics/ui/shadcn";
import { useRouterState } from "@tanstack/react-router";
import clsx from "clsx";
import {
  ChevronUp as ExpandLessIcon,
  ChevronDown as ExpandMoreIcon,
} from "lucide-react";
import React from "react";
import { adminConfig } from "@/app/config/adminConfig";
import { Link } from "@/shared/ui/link";
import type {
  AdminNavEntry,
  AdminNavGroup,
  AdminNavItem,
} from "./adminNavConfig";

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

function isItemVisible(item: AdminNavItem, role: string | null): boolean {
  if (!item.requiredRole) return true;
  return role === item.requiredRole;
}

const navItemBaseClass =
  "flex items-center gap-2 rounded-md py-[var(--padding-sidebar-item-y)] mx-2 text-sm transition-colors hover:bg-surface-elevated cursor-pointer";

export function AdminNav({
  items,
  onNavigate,
}: {
  items: AdminNavEntry[];
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentRole = useAuthSessionStore((state) => state.auth.role);

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
      <li key={item.id}>
        <Link
          to={item.to}
          onClick={onNavigate}
          className={clsx(
            navItemBaseClass,
            depth === 0 ? "pl-3" : "pl-8",
            selected && "bg-surface-elevated font-semibold",
          )}
        >
          <span className="inline-flex items-center min-w-9">{item.icon}</span>
          <span>{item.label()}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="mt-16 h-full flex flex-col">
      <div className="px-4 py-4">
        <p className="text-sm font-bold">{adminConfig.appName}</p>
        <p className="text-xs text-text-secondary">env: {adminConfig.env}</p>
      </div>
      <Separator />

      <ul className="py-2 flex flex-col gap-1 list-none">
        {items.map((entry) => {
          if (isItem(entry)) {
            if (!isItemVisible(entry, currentRole)) return null;
            return renderItem(entry, 0);
          }
          if (!isGroup(entry)) return null;

          const visibleChildren = entry.children.filter((child) =>
            isItemVisible(child, currentRole),
          );
          if (visibleChildren.length === 0) return null;

          const open = !!openGroups[entry.id];
          const anySelected = visibleChildren.some((child) =>
            isActivePath(pathname, child.to),
          );

          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    [entry.id]: !prev[entry.id],
                  }))
                }
                className={clsx(
                  navItemBaseClass,
                  "pl-3 w-[calc(100%-1rem)]",
                  anySelected && "bg-surface-elevated font-semibold",
                )}
              >
                <span className="inline-flex items-center min-w-9">
                  {entry.icon}
                </span>
                <span className="flex-1 text-left">{entry.label()}</span>
                {open ? (
                  <ExpandLessIcon size={16} />
                ) : (
                  <ExpandMoreIcon size={16} />
                )}
              </button>
              {open ? (
                <ul className="py-1 list-none">
                  {visibleChildren.map((child) =>
                    renderItem(child, 1, visibleChildren),
                  )}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex-1" />
      <Separator />
      <div className="px-4 py-3">
        <p className="text-xs text-text-secondary">REZICS Book Library</p>
      </div>
    </div>
  );
}
