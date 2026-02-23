import {type NavigationItem} from '../navigation/navigation';
import {useLayoutStore} from '../../state/layoutStore';
import type {SvgIconProps} from '@mui/material/SvgIcon';
import {
  ChevronLeft,
  ChevronRight,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import {Box, Icon, useTheme} from '@mui/material';
import {
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import {useRouterState} from '@tanstack/react-router';
import React, {type ReactNode} from 'react';

import useMeasure from 'react-use-measure';

import {Sidebar as UiSidebar} from './sidebar';
import {cn} from '@/shared/util/css-util';
import {useIsMobile} from '@/shared/util/use-media-query';
import {MUILink} from '@package/ui/primitive/link/MUILink.tsx';

export function DrawerHeader({
  handleDrawerToggle,
}: {
  handleDrawerToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 1,
        ...theme.mixins.toolbar, // ensures space below AppBar
        justifyContent: 'flex-end',
      }}
    >
      <IconButton onClick={handleDrawerToggle}>
        {theme.direction === 'ltr' ? <ChevronLeft /> : <ChevronRight />}
      </IconButton>
    </Box>
  );
}

interface SidebarProps {
  sidebarClassName?: string;
  sidebarHeaderClassName?: string;
  NAVIGATION: NavigationItem[];
  children?: ReactNode;
  isDragging?: boolean;
  layoutType?: 'type-a' | 'type-b';
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarClassName,
  sidebarHeaderClassName,
  NAVIGATION,
  children = null,
  isDragging = false,
  layoutType = 'type-b',
}) => {
  const isMobile = useIsMobile();
  const sidebarOpen = useLayoutStore(s => s.sidebarOpen);
  const sidebarWidth = useLayoutStore(s => s.drawerWidth);
  const handleDrawerToggle = useLayoutStore(s => s.toggleSidebar);
  const closeSidebar = useLayoutStore(s => s.closeSidebar);
  const {toggleItem, openItems} = useLayoutStore();
  const [refAbove, {height}] = useMeasure();
  const pathname = useRouterState({select: s => s.location.pathname});
  const handleSidebarClose = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  // All hooks must run unconditionally and in the same order every render.
  const heightBelow = `calc(100vh - ${height}px)`;

  const handleItemClick = (
    // @ts-expect-error - event is not used
    event: any,
    segment: string | undefined,
    hasChildren: boolean,
  ) => {
    // console.log("handleItemClick", event);
    if (!segment) return;
    if (hasChildren) {
      toggleItem(segment);
    } else {
      // setLocation(`${segment}`);
      if (isMobile) {
        handleSidebarClose();
      }
    }
  };

  const sidebarInner = (
    <>
      <div ref={refAbove} className={sidebarHeaderClassName}>
        <DrawerHeader handleDrawerToggle={handleDrawerToggle} />
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
      <div style={{height: heightBelow}}>{children}</div>
    </>
  );

  // Desktop: simple flex-based sidebar that pushes content by taking width.
  return (
    <UiSidebar
      isOpen={sidebarOpen}
      onClose={handleSidebarClose}
      mode={isMobile ? 'fixed' : 'inline'}
      width={`${sidebarWidth}px`}
      className={cn(sidebarClassName, 'rounded-lg overflow-auto')}
      isDragging={isDragging}
    >
      {sidebarInner}
    </UiSidebar>
  );
};
