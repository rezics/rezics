import {
  Add,
  CheckCircle,
  Error as ErrorIcon,
  Favorite,
  Info,
  Share,
  Warning,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Fab,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import { PRESET_COLORS } from "@rezics/ui";
import type React from "react";
import { useAppStore } from "@/app/states/appStore";

export const ThemeDemo: React.FC = () => {
  const theme = useTheme();
  const useDynamicTheme = useAppStore((state) => state.useDynamicTheme);
  const customColor = useAppStore((state) => state.customColor);

  const demoItems = [
    { icon: <CheckCircle />, text: "任务已完成", color: "success" },
    { icon: <Warning />, text: "需要注意", color: "warning" },
    { icon: <Info />, text: "信息提示", color: "info" },
    { icon: <ErrorIcon />, text: "错误警告", color: "error" },
  ];

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      {/* 标题区域 */}
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h3" gutterBottom color="primary">
          动态主题演示
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          体验基于 Material Design 3 的动态颜色系统
        </Typography>

        {useDynamicTheme && customColor && (
          <Alert severity="success" sx={{ mt: 2, maxWidth: 600, mx: "auto" }}>
            动态主题已启用，当前种子颜色: {customColor.toUpperCase()}
          </Alert>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* 颜色系统演示 */}
        <Grid sx={{ xs: 12, md: 6 }}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h5" gutterBottom color="primary">
                颜色系统
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  主要颜色
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    label="Primary"
                    sx={{
                      backgroundColor: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                    }}
                  />
                  <Chip
                    label="Secondary"
                    sx={{
                      backgroundColor: theme.palette.secondary.main,
                      color: theme.palette.secondary.contrastText,
                    }}
                  />
                  <Chip
                    label="Error"
                    sx={{
                      backgroundColor: theme.palette.error.main,
                      color: theme.palette.error.contrastText,
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  表面颜色
                </Typography>
                <Box display="flex" gap={1} mb={2}>
                  <Paper
                    sx={{
                      p: 2,
                      backgroundColor: theme.palette.background.default,
                      border: `1px solid ${theme.palette.divider}`,
                      flex: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Background
                    </Typography>
                  </Paper>
                  <Paper
                    sx={{
                      p: 2,
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      flex: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Surface
                    </Typography>
                  </Paper>
                </Box>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  文本颜色
                </Typography>
                <Typography variant="body1" color="text.primary" gutterBottom>
                  主要文本 (Primary Text)
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  次要文本 (Secondary Text)
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  禁用文本 (Disabled Text)
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 组件演示 */}
        <Grid sx={{ xs: 12, md: 6 }}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h5" gutterBottom color="primary">
                组件展示
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  按钮
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button variant="contained">Contained</Button>
                  <Button variant="outlined">Outlined</Button>
                  <Button variant="text">Text</Button>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  状态指示
                </Typography>
                <List dense>
                  {demoItems.map((item, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list
                    <ListItem key={index}>
                      <ListItemIcon
                        sx={{
                          color: `${item.color}.main`,
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItem>
                  ))}
                </List>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  进度条
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={75}
                  sx={{ mb: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  75% 完成
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 卡片组合演示 */}
        <Grid sx={{ xs: 12 }}>
          <Typography variant="h5" gutterBottom color="primary" sx={{ mb: 3 }}>
            卡片组合演示
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(PRESET_COLORS)
              .slice(0, 8)
              .map(([name, color]) => (
                <Grid sx={{ xs: 12, sm: 6, md: 3 }} key={name}>
                  <Card
                    elevation={2}
                    sx={{
                      background: `linear-gradient(135deg, ${alpha(
                        color,
                        0.1,
                      )} 0%, ${alpha(color, 0.05)} 100%)`,
                      border: `1px solid ${alpha(color, 0.2)}`,
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: theme.shadows[8],
                      },
                    }}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <Avatar
                          sx={{
                            backgroundColor: color,
                            width: 40,
                            height: 40,
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" color="text.primary">
                            {name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {color}
                          </Typography>
                        </Box>
                      </Box>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        这是一个使用 {name} 颜色主题的演示卡片。
                      </Typography>

                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Box>
                          <Button
                            size="small"
                            sx={{
                              color: color,
                              "&:hover": {
                                backgroundColor: alpha(color, 0.1),
                              },
                            }}
                          >
                            查看
                          </Button>
                        </Box>
                        <Box>
                          <Button size="small" color="inherit">
                            <Favorite fontSize="small" />
                          </Button>
                          <Button size="small" color="inherit">
                            <Share fontSize="small" />
                          </Button>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Grid>
      </Grid>

      {/* 浮动操作按钮 */}
      <Fab
        color="primary"
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          boxShadow: theme.shadows[8],
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
};
