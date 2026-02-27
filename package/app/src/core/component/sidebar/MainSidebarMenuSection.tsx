import {type NavigationItem} from '../navigation/navigation';
import {useLayoutStore} from '../../state/layoutStore';
import type {SvgIconProps} from '@mui/material/SvgIcon';
import {
  ChevronLeft,
  ChevronRight,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import {
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {useRouterState} from '@tanstack/react-router';
import React, {type ReactNode} from 'react';

import useMeasure from 'react-use-measure';

import {Sidebar as UiSidebar} from './sidebar';
import {cn} from '@/shared/util/css-util';
import {useIsMobile} from '@/shared/util/use-media-query';
import {MUILink} from '@package/ui/primitive/link/MUILink.tsx';
import {MainSidebarDrawerHeader} from './MainSidebarDrawerHeader';

interface MainSidebarMenuSectionProps {
  handleDrawerToggle: () => void;
  handleItemClick: (
    event: any,
    segment: string | undefined,
    hasChildren: boolean,
  ) => void;
  layoutType: 'type-a' | 'type-b';
  NAVIGATION: NavigationItem[];
  isMobile: boolean;
  pathname: string;
  openItems: Record<string, boolean>;
}

export function MainSidebarMenuSection({
  handleDrawerToggle,
  handleItemClick,
  layoutType,
  NAVIGATION,
  isMobile,
  pathname,
  openItems,
}: MainSidebarMenuSectionProps) {
  return (
    <div>
      <MainSidebarDrawerHeader handleDrawerToggle={handleDrawerToggle} />
      {layoutType === 'type-a' && <Divider />}
      {layoutType === 'type-b' && <div className="mt-2" />}
      <List>
        {NAVIGATION.map((item, index) => {
          if (item.kind === 'item' && item.onlyMobile && !isMobile) {
            return null;
          }

          if (item.kind === 'divider')
            return <Divider key={index} className="my-1 mx-2" />;

          const isActive = pathname === `/${item.segment}`;
          const hasChildren = !!item.children && item.children.length > 0;
          const isOpen = item.segment ? !!openItems[item.segment] : false;

          return (
            <div key={item.segment || index.toString()}>
              <ListItemButton
                className="py-1"
                component={hasChildren ? 'div' : MUILink}
                {...(!hasChildren ? {to: `${item.segment}`} : {})}
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
                          sx={{pl: 4}}
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
    </div>
  );
}
