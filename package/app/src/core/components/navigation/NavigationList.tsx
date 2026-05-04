import { Separator } from "@rezics/ui/shadcn";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import { cn } from "@/shared/utils/css-util";
import type { NavigationItem } from "./navigation";
import { ChevronUp as ExpandLess, ChevronDown as ExpandMore } from "lucide-react";

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
  "flex items-center gap-3 w-full px-3 py-1 rounded-md text-left text-sm transition-colors hover:bg-surface-subtle";

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

        const isActive = pathname === `/${item.segment}`;
        const hasChildren = !!item.children && item.children.length > 0;
        const isOpen = item.segment ? !!openItems[item.segment] : false;
        const Icon = item.icon;

        return (
          <li key={item.segment || index.toString()}>
            {hasChildren ? (
              <button
                type="button"
                className={cn(
                  itemBaseClass,
                  isActive && "bg-surface-subtle",
                )}
                onClick={(event: any) =>
                  handleItemClick(event, item.segment, hasChildren)
                }
              >
                {Icon ? <Icon className="w-4 h-4" /> : null}
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
                onClick={(event: any) =>
                  handleItemClick(event, item.segment, hasChildren)
                }
              >
                {Icon ? <Icon className="w-4 h-4" /> : null}
                <span className="flex-1 dark:text-light text-dark">
                  {item.title}
                </span>
              </TextLink>
            )}

            {hasChildren && item.segment && isOpen && (
              <ul className="list-none m-0 p-0">
                {item.children?.map((child: any) => {
                  const isChildActive = pathname === `/${child.segment}`;
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
                        onClick={(event: any) =>
                          handleItemClick(event, child.segment, false)
                        }
                      >
                        {ChildIcon ? <ChildIcon className="w-4 h-4" /> : null}
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
