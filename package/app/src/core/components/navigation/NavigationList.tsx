import { Separator } from "@rezics/ui/shadcn";
import {
  ChevronUp as ExpandLess,
  ChevronDown as ExpandMore,
} from "lucide-react";
import { TextLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import type { NavigationItem } from "./navigation";

interface NavigationListProps {
  NAVIGATION: NavigationItem[];
  isMobile: boolean;
  pathname: string;
  openItems: Record<string, boolean>;
  handleItemClick: (
    event: any,
    segment: string | undefined,
    hasChildren: boolean,
  ) => void;
}

const itemBaseClass =
  "flex items-center gap-3 w-full px-3 py-1 rounded-md text-left text-sm transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus";

function normalizePath(value: string) {
  const normalized = value.startsWith("/") ? value : `/${value}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function matchesNavigationItem(
  pathname: string,
  item: Extract<NavigationItem, { kind: "item" }>,
) {
  if (item.isActive?.(pathname)) return true;

  const normalizedPathname = normalizePath(pathname);
  const itemPath = normalizePath(item.segment);

  if (item.activeMatch === "prefix") {
    return (
      normalizedPathname === itemPath ||
      normalizedPathname.startsWith(`${itemPath}/`)
    );
  }

  return normalizedPathname === itemPath;
}

export const NavigationList = ({
  NAVIGATION,
  isMobile,
  pathname,
  openItems,
  handleItemClick,
}: NavigationListProps) => {
  return (
    <ul className="list-none m-0 p-0">
      {NAVIGATION.map((item, index) => {
        if (item.kind === "item" && item.onlyMobile && !isMobile) {
          return null;
        }

        if (item.kind === "divider")
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            <li key={index}>
              <Separator className="my-1 mx-2" />
            </li>
          );

        const normalizedPathname = normalizePath(pathname);
        const isActive = matchesNavigationItem(pathname, item);
        const hasChildren = !!item.children && item.children.length > 0;
        const isOpen = item.segment ? !!openItems[item.segment] : false;
        const Icon = item.icon;

        return (
          <li key={item.segment || index.toString()}>
            {hasChildren ? (
              <button
                type="button"
                className={cn(itemBaseClass, isActive && "bg-surface-subtle")}
                aria-current={isActive ? "page" : undefined}
                onClick={(event: any) =>
                  handleItemClick(event, item.segment, hasChildren)
                }
              >
                {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
                <span className="flex-1 dark:text-light text-dark">
                  {item.title}
                </span>
                <span className="dark:text-light text-dark">
                  {isOpen ? <ExpandLess /> : <ExpandMore />}
                </span>
              </button>
            ) : (
              <TextLink
                to={`${item.segment}` as any}
                className={cn(
                  itemBaseClass,
                  "no-underline",
                  isActive && "bg-surface-subtle",
                )}
                aria-current={isActive ? "page" : undefined}
                onClick={(event: any) =>
                  handleItemClick(event, item.segment, hasChildren)
                }
              >
                {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
                <span className="flex-1 dark:text-light text-dark">
                  {item.title}
                </span>
              </TextLink>
            )}

            {hasChildren && item.segment && isOpen && (
              <ul className="list-none m-0 p-0">
                {item.children?.map((child: any) => {
                  const isChildActive =
                    normalizedPathname === normalizePath(child.segment);
                  const ChildIcon = child.icon;
                  return (
                    <li key={child.segment}>
                      <TextLink
                        to={`${child.segment}` as any}
                        className={cn(
                          itemBaseClass,
                          "pl-8 no-underline",
                          isChildActive && "bg-surface-subtle",
                        )}
                        aria-current={isChildActive ? "page" : undefined}
                        onClick={(event: any) =>
                          handleItemClick(event, child.segment, false)
                        }
                      >
                        {ChildIcon ? (
                          <ChildIcon className="w-4 h-4" aria-hidden="true" />
                        ) : null}
                        <span className="flex-1 dark:text-light text-dark">
                          {child.title}
                        </span>
                      </TextLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
};
