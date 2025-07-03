import React, { ReactNode, useMemo } from "react";
import { useLocation } from "wouter";
import { useMediaQuery, styled, useTheme } from "@mui/material";
import { useSnapshot } from "valtio";
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
    children?: ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
    onClose,
    handleDrawerToggle,
    NAVIGATION,
    children = null,
}) => {
    const { sidebarOpen, sidebarHeightBelow, toggleSidebar, setSidebarHeightBelow, toggleItem, openItems, drawerWidth } =
        useLayoutStore();

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

    const heightBelow = useMemo(() => {
        setSidebarHeightBelow(windowHeight - height - 48);
        console.log("layoutState.sidebarHeightBelow", sidebarHeightBelow);
        console.log(sidebarOpen);
        return `calc(100vh - ${height}px)`;
    }, [height, windowHeight]);

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
            className="transition-all duration-300 ease-out"
        >
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
            <div style={{ height: heightBelow }}>{children}</div>
        </Drawer>
    );
};
