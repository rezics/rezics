import React, { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useMediaQuery, styled, useTheme } from "@mui/material";
import { ExpandLess, ExpandMore, ChevronLeft, ChevronRight } from "@mui/icons-material";
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
} from "@mui/material";
import { useLayoutStore } from "@/global/layoutStore";
import { NavigationItem } from "./navigation";

import useMeasure from "react-use-measure";
import { useWindowSize } from "react-use";

interface SidebarProps {
    onClose: () => void;
    handleDrawerToggle: () => void;
    NAVIGATION: NavigationItem[];
    noScrollBar?: boolean;
    children?: ReactNode;
    onOverflowx?: boolean;
    onOverflowy?: boolean;
    isDragging?: boolean;
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
}) => {
    const { sidebarOpen, setSidebarHeightBelow, toggleItem, openItems, drawerWidth } = useLayoutStore();

    const theme = useTheme();

    const DrawerHeader = styled("div")({
        display: "flex",
        alignItems: "center",
        padding: theme.spacing(0, 1),
        // necessary for content to be below app bar
        ...theme.mixins.toolbar,
        justifyContent: "flex-end",
    });

    const [location, setLocation] = useLocation();
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));

    const handleItemClick = (segment: string | undefined, hasChildren: boolean) => {
        if (!segment) return;
        if (hasChildren) {
            toggleItem(segment);
        } else {
            setLocation(`${segment}`);
            if (isMobile) {
                onClose();
            }
        }
    };

    const [refAbove, { height }] = useMeasure();
    const { height: windowHeight } = useWindowSize();

    // Update the global store **after** render whenever height/windowHeight changes
    useEffect(() => {
        setSidebarHeightBelow(windowHeight - height - 48);
    }, [height, windowHeight]);

    // Local value just for rendering
    const heightBelow = `calc(100vh - ${height}px)`;

    useEffect(() => {
        const wrapperId = "ics-sidebar-wrapper";
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;

        const firstDiv = wrapper.querySelector("div");
        if (firstDiv) {
            if (noScrollBar) {
                firstDiv.classList.add("no-scrollbar");
            }
            if (onOverflowx) {
                firstDiv.classList.add("!overflow-x-hidden");
            }
            if (onOverflowy) {
                firstDiv.classList.add("!overflow-y-hidden");
            }
        }
    }, [noScrollBar, onOverflowx, onOverflowy]);

    return (
        <Drawer
            variant={isMobile ? "temporary" : "persistent"}
            open={sidebarOpen}
            onClose={onClose}
            style={{
                width: sidebarOpen ? drawerWidth : 0,
            }}
            slotProps={{
                paper: {
                    style: {
                        width: sidebarOpen ? drawerWidth : 0,
                        transition: "all 0.3s ease-out",
                    },
                },
            }}
            id="ics-sidebar-wrapper"
            className="transition-all duration-300 ease-out"
        >
            {!isDragging && (
                <div ref={refAbove}>
                    <DrawerHeader>
                        <IconButton onClick={handleDrawerToggle}>
                            {theme.direction === "ltr" ? <ChevronLeft /> : <ChevronRight />}
                        </IconButton>
                    </DrawerHeader>
                    <Divider />
                    <List>
                        {NAVIGATION.map((item, index) => {
                            if (item.kind === "header") {
                                return (
                                    <ListItem key={index}>
                                        <Typography variant="caption">{item.title}</Typography>
                                    </ListItem>
                                );
                            }

                            if (item.kind === "divider") {
                                return <Divider key={index} />;
                            }

                            const isActive = location === `/${item.segment}`;
                            const hasChildren = !!item.children && item.children.length > 0;
                            const isOpen = item.segment ? !!openItems[item.segment] : false;

                            return (
                                <div key={item.segment || index.toString()}>
                                    <ListItemButton
                                        selected={isActive && !hasChildren}
                                        onClick={() => handleItemClick(item.segment, hasChildren)}
                                    >
                                        <ListItemIcon>{item.icon}</ListItemIcon>
                                        <ListItemText primary={item.title} />
                                        {hasChildren && <span>{isOpen ? <ExpandLess /> : <ExpandMore />}</span>}
                                    </ListItemButton>

                                    {hasChildren && item.segment && (
                                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                            <List component="div" disablePadding>
                                                {item.children?.map((child) => {
                                                    const isChildActive = location === `/${child.segment}`;
                                                    return (
                                                        <ListItemButton
                                                            key={child.segment}
                                                            selected={isChildActive}
                                                            onClick={() => handleItemClick(child.segment, false)}
                                                            sx={{ pl: 4 }}
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
            {!isDragging && <div style={{ height: heightBelow }}>{children}</div>}
        </Drawer>
    );
};
