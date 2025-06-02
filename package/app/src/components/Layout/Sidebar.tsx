import React from "react";
import { useLocation } from "wouter";
import { NAVIGATION } from "./navigation";
import { useMediaQuery, styled, useTheme } from "@mui/material";
import { layoutState, layoutActions } from "@/stores/layout";
import { useSnapshot } from "valtio";
import { ExpandLess, ExpandMore, ChevronLeft, ChevronRight } from "@mui/icons-material";
import { theme } from "@/config/theme";

interface SidebarProps {
    onClose: () => void;
    handleDrawerToggle: () => void;
    drawerWidth: any;
}

const DrawerHeader = styled("div")({
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: "flex-end",
});

export const Sidebar: React.FC<SidebarProps> = ({ onClose, handleDrawerToggle, drawerWidth }) => {
    const [location, setLocation] = useLocation();
    const layoutStatesnap = useSnapshot(layoutState);
    const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
    const theme = useTheme();
    const drawerWidthsnap = useSnapshot(drawerWidth);

    const handleItemClick = (segment: string | undefined, hasChildren: boolean) => {
        if (!segment) return;
        if (hasChildren) {
            layoutActions.toggleItem(segment);
        } else {
            setLocation(`${segment}`);
            if (isMobile) {
                onClose();
            }
        }
    };

    return (
        <Drawer
            variant={isMobile ? "temporary" : "persistent"}
            open={layoutStatesnap.sidebarOpen}
            onClose={onClose}
            style={{
                width: layoutStatesnap.sidebarOpen ? drawerWidthsnap.data : 0,
            }}
            slotProps={{
                paper: {
                    style: {
                        width: layoutStatesnap.sidebarOpen ? drawerWidthsnap.data : 0,
                        transition: 'all 0.3s ease-out',
                    }
                }
            }}
            className="transition-all duration-300 ease-out"
        >
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
                    const isOpen = item.segment ? !!layoutStatesnap.openItems[item.segment] : false;

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
        </Drawer>
    );
};
