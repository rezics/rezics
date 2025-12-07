import {type NavigationItem} from '@/component/Layout/Navigation/navigation';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';
import {
  ChevronLeft,
  ChevronRight,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import {styled, useMediaQuery, useTheme} from '@mui/material';
import {
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import React, {type ReactNode, useEffect} from 'react';
import {Link, useLocation} from 'wouter';

import {useWindowSize} from 'react-use';
import useMeasure from 'react-use-measure';

function customWrapperOverflow(
  noScrollBar: boolean,
  onOverflowx: boolean,
  onOverflowy: boolean,
) {
  const wrapperId = 'ics-sidebar-wrapper';
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;

  const firstDiv = wrapper.querySelector('div');
  if (firstDiv) {
    if (noScrollBar) {
      firstDiv.classList.add('no-scrollbar');
    }
    if (onOverflowx) {
      firstDiv.classList.add('!overflow-x-hidden');
    }
    if (onOverflowy) {
      firstDiv.classList.add('!overflow-y-hidden');
    }
  }
}

export function DrawerHeader({
  handleDrawerToggle,
}: {
  handleDrawerToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: theme.spacing(0, 1),
        ...theme.mixins.toolbar, // ensures space below AppBar
        justifyContent: 'flex-end',
      }}
    >
      <IconButton onClick={handleDrawerToggle}>
        {theme.direction === 'ltr' ? <ChevronLeft /> : <ChevronRight />}
      </IconButton>
    </div>
  );
}

interface SidebarProps {
  onClose: () => void;
  handleDrawerToggle: () => void;
  NAVIGATION: NavigationItem[];
  noScrollBar?: boolean;
  children?: ReactNode;
  onOverflowx?: boolean;
  onOverflowy?: boolean;
  isDragging?: boolean;
  layoutType?: 'type-a' | 'type-b';
}

export const Sidebar: React.FC<SidebarProps> = ({
  onClose,
  handleDrawerToggle,
  NAVIGATION,
  children = null,
  noScrollBar = false,
  onOverflowx = false,
  onOverflowy = false,
  isDragging = false,
  layoutType = 'type-b',
}) => {
  const {
    sidebarOpen,
    setSidebarHeightBelow,
    toggleItem,
    openItems,
    drawerWidth,
  } = useLayoutStore();

  const [refAbove, {height}] = useMeasure();
  const {height: windowHeight} = useWindowSize();

  useEffect(() => {
    setSidebarHeightBelow(windowHeight - height - 200);
  }, [height, windowHeight, setSidebarHeightBelow]);

  const heightBelow = `calc(100vh - ${height}px)`;

  useEffect(() => {
    customWrapperOverflow(noScrollBar, onOverflowx, onOverflowy);
  }, [noScrollBar, onOverflowx, onOverflowy]);

  const [location, _setLocation] = useLocation();
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('md'));

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

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'persistent'}
      open={sidebarOpen}
      onClose={onClose}
      slotProps={{
        paper: {
          style: !isMobile
            ? {width: drawerWidth, transition: 'width 0.3s ease-out'}
            : {width: drawerWidth}, // mobile 不动 width，不动 transition
        },
      }}
      sx={{
        ...(isMobile && {
          '& .MuiDrawer-paper': {
            transition: 'transform 225ms cubic-bezier(0, 0, 0.2, 1)',
          },
        }),
      }}
    >
      {!isDragging && (
        <div ref={refAbove}>
          <DrawerHeader handleDrawerToggle={handleDrawerToggle} />
          {layoutType === 'type-a' && <Divider />}
          {layoutType === 'type-b' && <div className="mt-2" />}
          <List>
            {NAVIGATION.map((item, index) => {
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

              const isActive = location === `/${item.segment}`;
              const hasChildren = !!item.children && item.children.length > 0;
              const isOpen = item.segment ? !!openItems[item.segment] : false;

              return (
                <div key={item.segment || index.toString()}>
                  <ListItemButton
                    component={Link}
                    href={hasChildren ? '' : `${item.segment}`}
                    selected={isActive && !hasChildren}
                    onClick={(event: any) =>
                      handleItemClick(event, item.segment, hasChildren)
                    }
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.title} />
                    {hasChildren && (
                      <span>{isOpen ? <ExpandLess /> : <ExpandMore />}</span>
                    )}
                  </ListItemButton>

                  {hasChildren && item.segment && (
                    <Collapse in={isOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {item.children?.map((child: any) => {
                          const isChildActive =
                            location === `/${child.segment}`;
                          return (
                            <ListItemButton
                              key={child.segment}
                              component={Link}
                              href={`${child.segment}`}
                              selected={isChildActive}
                              onClick={event =>
                                handleItemClick(event, child.segment, false)
                              }
                              sx={{pl: 4}}
                            >
                              <ListItemIcon>{child.icon}</ListItemIcon>
                              <ListItemText primary={child.title} />
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
      )}
      {!isDragging && <div style={{height: heightBelow}}>{children}</div>}
    </Drawer>
  );
};
