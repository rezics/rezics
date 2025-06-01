import React from "react";
import { Router, Route } from "wouter";
import { useSnapshot } from "valtio";
import { Box, Drawer, Toolbar, AppBar, Typography, CssBaseline } from "@mui/material";

import { appStore } from "@/stores/appStore";
import { uiStore } from "@/stores/uiStore";

import DialogReply from "@/components/Form/DialogReply";

const drawerWidth = 260;

const MainLayout = () => {
  const appSnap = useSnapshot(appStore);
  const dialogSnap = useSnapshot(dialogStore);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      {/* Top App Bar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, height: 60, justifyContent: 'center' }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Application Toolbar
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            top: 60,
            height: 'calc(100% - 60px)',
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', p: 2 }}>
          {/* Sidebar content placeholder */}
          <Typography variant="body1">Sidebar Menu</Typography>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: 8,
          pl: `${drawerWidth}px`,
          transition: 'all 0.5s',
        }}
      >
        <Router>
          <Route path="/">
            <Typography variant="h4">Main Content Here</Typography>
          </Route>
          {/* Add more routes here */}
        </Router>

        {dialogSnap.dialogVisible && <DialogReply />}
      </Box>
    </Box>
  );
};

export default MainLayout;
