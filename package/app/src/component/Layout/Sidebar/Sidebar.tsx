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
import React, {type ReactNode, useEffect} from 'react';
import {Link, useLocation} from 'wouter';

import {useWindowSize} from 'react-use';
import useMeasure from 'react-use-measure';

import {Sidebar as UiSidebar} from '@/component/ui/sidebar';

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
  isMobile,
  sidebarOpen,
  sidebarWidth,
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
  const {setSidebarHeightBelow, toggleItem, openItems} = useLayoutStore();
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

  const sidebarInner = !isDragging && (
    <>
      <div ref={refAbove}>
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
                        const isChildActive = location === `/${child.segment}`;
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
      // width={`${sidebarWidth}px`}
    >
      {sidebarInner}
    </UiSidebar>
  );
};
