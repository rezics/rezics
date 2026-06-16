import { Separator } from "@rezics/ui/shadcn";
import {
  ChevronUp as ExpandLess,
  ChevronDown as ExpandMore,
} from "lucide-react";
import { TextLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import {
  type NavigationItem,
  navigationRowClassName,
  navigationSectionHeaderClassName,
} from "./navigation";

interface NavigationListProps {
  NAVIGATION: NavigationItem[];
  isMobile: boolean;
  pathname: string;
  openItems: Record<string, boolean>;
  handleItemClick: (
    event: any,
    segment: string | undefined,
    hasChildren: boolean,
    defaultOpen?: boolean,
  ) => void;
}

export const NavigationList = ({
  NAVIGATION,
  isMobile,
  pathname,
  openItems,
  handleItemClick,
}: NavigationListProps) => {
  const renderItems = (items: NavigationItem[]) => (
    <ul className="list-none m-0 p-0">
      {items.map((item, index) => {
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

        if (item.kind === "status") {
          return (
            <li key={item.id}>
              <div
                className={cn(
                  navigationRowClassName,
                  "pointer-events-none text-xs hover:bg-transparent",
                  item.tone === "danger"
                    ? "text-error-text"
                    : "text-text-tertiary",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </div>
            </li>
          );
        }

        if (item.kind === "section") {
          const sectionOpen =
            openItems[item.id] ?? item.defaultOpen ?? !item.collapsible;
          const hasVisibleTitle = Boolean(item.title);
          return (
            <li key={item.id}>
              {hasVisibleTitle ? (
                item.collapsible ? (
                  <button
                    type="button"
                    className={cn(
                      navigationSectionHeaderClassName,
                      "rounded-md hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                    )}
                    aria-expanded={sectionOpen}
                    onClick={(event: any) =>
                      handleItemClick(event, item.id, true, item.defaultOpen)
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {item.title}
                    </span>
                    <span className="text-text-tertiary">
                      {sectionOpen ? (
                        <ExpandLess className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ExpandMore className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                  </button>
                ) : (
                  <div className={navigationSectionHeaderClassName}>
                    {item.title}
                  </div>
                )
              ) : null}
              {sectionOpen ? renderItems(item.children) : null}
            </li>
          );
        }

        const normalizedPathname = normalizePath(pathname);
        const isActive = matchesNavigationItem(pathname, item);
        const hasChildren = !!item.children && item.children.length > 0;
        const isOpen = item.segment ? !!openItems[item.segment] : false;
        const Icon = item.icon;

        return (
          <li key={itemKey(item, index)}>
            {hasChildren ? (
              <button
                type="button"
                className={cn(
                  navigationRowClassName,
                  isActive && "bg-surface-subtle",
                )}
                aria-current={isActive ? "page" : undefined}
                data-subscription-unit-id={
                  item.subscriptionListEntry?.subscribedUnitId
                }
                data-subscription-type={
                  item.subscriptionListEntry?.subscribedType
                }
                data-subscription-pinned={item.subscriptionListEntry?.pinned}
                onClick={(event: any) =>
                  handleItemClick(event, item.segment, hasChildren)
                }
              >
                {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1 truncate text-text-primary">
                  {item.title}
                </span>
                <span className="text-text-primary">
                  {isOpen ? (
                    <ExpandLess className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ExpandMore className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
              </button>
            ) : (
              <TextLink
                to={`${item.segment}` as any}
                className={cn(
                  navigationRowClassName,
                  "no-underline",
                  isActive && "bg-surface-subtle",
                )}
                aria-current={isActive ? "page" : undefined}
                data-subscription-unit-id={
                  item.subscriptionListEntry?.subscribedUnitId
                }
                data-subscription-type={
                  item.subscriptionListEntry?.subscribedType
                }
                data-subscription-pinned={item.subscriptionListEntry?.pinned}
                onClick={(event: any) =>
                  handleItemClick(event, item.segment, hasChildren)
                }
              >
                {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1 truncate text-text-primary">
                  {item.title}
                </span>
              </TextLink>
            )}

            {hasChildren && item.segment && isOpen && (
              <ul className="list-none m-0 p-0">
                {item.children?.map((child: any, childIndex: number) => {
                  if (child.kind !== "item") return null;
                  const isChildActive =
                    normalizedPathname === normalizePath(child.segment);
                  const ChildIcon = child.icon;
                  return (
                    <li key={itemKey(child, childIndex)}>
                      <TextLink
                        to={`${child.segment}` as any}
                        className={cn(
                          navigationRowClassName,
                          "no-underline",
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
                        <span className="min-w-0 flex-1 truncate text-text-primary">
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

  return renderItems(NAVIGATION);
};

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

function itemKey(item: NavigationItem, fallback: number) {
  if (item.kind === "item") return item.segment;
  if (item.kind === "section" || item.kind === "status") return item.id;
  return `divider-${fallback}`;
}
