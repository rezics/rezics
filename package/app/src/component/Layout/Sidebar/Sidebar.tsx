import {type NavigationItem} from '@/component/Layout/Navigation/navigation';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';
import {
  ChevronLeft,
  ChevronRight,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import {Box, useTheme} from '@mui/material';
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
import React, {type ReactNode, useEffect} from 'react';

import {useWindowSize} from 'react-use';
import useMeasure from 'react-use-measure';

import {Sidebar as UiSidebar} from '@/component/shadcn/sidebar';
import {cn} from '@/shared/shadcn/lib/utils';
import {RouterLink} from '@package/ui/Navigation/RouterLink.tsx';

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
  isMobile: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarClassName?: string;
  sidebarHeaderClassName?: string;
  onClose: () => void;
  handleDrawerToggle: () => void;
  NAVIGATION: NavigationItem[];
  children?: ReactNode;
  isDragging?: boolean;
  layoutType?: 'type-a' | 'type-b';
}

export const Sidebar: React.FC<SidebarProps> = ({
  isMobile,
  sidebarOpen,
  sidebarWidth,
  sidebarClassName,
  sidebarHeaderClassName,
  onClose,
  handleDrawerToggle,
  NAVIGATION,
  children = null,
  isDragging = false,
  layoutType = 'type-b',
}) => {
  const {setSidebarHeightBelow, toggleItem, openItems} = useLayoutStore();
  const [refAbove, {height}] = useMeasure();

  // ERROR cause react hooks order error
  // const {height: windowHeight} = useWindowSize();
  // useEffect(() => {
  //   setSidebarHeightBelow(windowHeight - height - 200);
  // }, [height, windowHeight, setSidebarHeightBelow]);

  const heightBelow = `calc(100vh - ${height}px)`;

  const pathname = useRouterState({select: s => s.location.pathname});

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
        onClose();
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
            if (item.onlyMobile && !isMobile) {
              return null;
            }
            if (item.kind === 'header') {
              return (
                <ListItem key={index}>
                  <Typography variant="caption">{item.title}</Typography>
                </ListItem>
              );
            }

            if (item.kind === 'divider') {
              return <Divider key={index} />;
            }

            const isActive = pathname === `/${item.segment}`;
            const hasChildren = !!item.children && item.children.length > 0;
            const isOpen = item.segment ? !!openItems[item.segment] : false;

            return (
              <div key={item.segment || index.toString()}>
                <ListItemButton
                  component={hasChildren ? 'div' : RouterLink}
                  {...(!hasChildren ? {to: `${item.segment}`} : {})}
                  selected={isActive && !hasChildren}
                  onClick={(event: any) =>
                    handleItemClick(event, item.segment, hasChildren)
                  }
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
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
                            component={RouterLink}
                            to={`${child.segment}`}
                            selected={isChildActive}
                            onClick={event =>
                              handleItemClick(event, child.segment, false)
                            }
                            sx={{pl: 4}}
                          >
                            <ListItemIcon>{child.icon}</ListItemIcon>
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
      onClose={onClose}
      mode={isMobile ? 'fixed' : 'inline'}
      width={`${sidebarWidth}px`}
      className={cn(sidebarClassName, 'rounded-lg')}
      isDragging={isDragging}
    >
      {sidebarInner}
      <div>test</div>
    </UiSidebar>
  );
};
