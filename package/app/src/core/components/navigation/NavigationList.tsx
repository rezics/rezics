import { ExpandLess, ExpandMore } from "@mui/icons-material";
import {
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
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

export const NavigationList = ({
  NAVIGATION,
  isMobile,
  pathname,
  openItems,
  handleItemClick,
}: NavigationListProps) => {
  return (
    <List>
      {NAVIGATION.map((item, index) => {
        if (item.kind === "item" && item.onlyMobile && !isMobile) {
          return null;
        }

        if (item.kind === "divider")
          // biome-ignore lint/suspicious/noArrayIndexKey: static list
          return <Divider key={index} className="my-1 mx-2" />;

        const isActive = pathname === `/${item.segment}`;
        const hasChildren = !!item.children && item.children.length > 0;
        const isOpen = item.segment ? !!openItems[item.segment] : false;

        return (
          <div key={item.segment || index.toString()}>
            <ListItemButton
              className="py-1"
              component={hasChildren ? "div" : MUILink}
              {...(!hasChildren ? { to: `${item.segment}` } : {})}
              selected={isActive && !hasChildren}
              onClick={(event: any) =>
                handleItemClick(event, item.segment, hasChildren)
              }
            >
              <ListItemIcon>
                {(() => {
                  const Icon = item.icon;
                  return Icon ? <Icon fontSize="small" /> : null;
                })()}
              </ListItemIcon>
              <ListItemText
                className="dark:text-light text-dark"
                primary={item.title}
              />
              {hasChildren && (
                <span className="dark:text-light text-dark">
                  {isOpen ? <ExpandLess /> : <ExpandMore />}
                </span>
              )}
            </ListItemButton>

            {hasChildren && item.segment && (
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {item.children?.map((child: any) => {
                    const isChildActive = pathname === `/${child.segment}`;
                    return (
                      <ListItemButton
                        key={child.segment}
                        component={MUILink}
                        to={`${child.segment}`}
                        selected={isChildActive}
                        onClick={(event: any) =>
                          handleItemClick(event, child.segment, false)
                        }
                        className="py-1"
                        sx={{ pl: 4 }}
                      >
                        {(() => {
                          const Icon = child.icon;
                          return <Icon fontSize="small" />;
                        })()}
                        <ListItemText
                          className="dark:text-light text-dark"
                          primary={child.title}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            )}
          </div>
        );
      })}
    </List>
  );
};
