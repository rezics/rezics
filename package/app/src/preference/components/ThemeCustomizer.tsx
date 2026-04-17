import {
  Close as CloseIcon,
  Palette as PaletteIcon,
  Photo as PhotoIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { extractColorFromImage, PRESET_COLORS } from "@rezics/ui";
import type React from "react";
import { useState } from "react";
import { useAppStore } from "@/app/states/appStore";

interface ThemeCustomizerProps {
  open: boolean;
  onClose: () => void;
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();
  const customColor = useAppStore((state: any) => state.customColor);
  const useDynamicTheme = useAppStore((state: any) => state.useDynamicTheme);
  const setCustomColor = useAppStore((state: any) => state.setCustomColor);
  const setUseDynamicTheme = useAppStore(
    (state: any) => state.setUseDynamicTheme,
  );

  const [selectedColor, setSelectedColor] = useState(customColor || "#f4606c");
  const [customHex, setCustomHex] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setCustomColor(color);
  };

  const handleCustomHexChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    setCustomHex(value);

    // 验证十六进制颜色格式
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      setSelectedColor(value);
      setCustomColor(value);
    }
  };

  const handleDynamicThemeToggle = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setUseDynamicTheme(event.target.checked);
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setIsExtracting(true);

    try {
      const imageUrl = URL.createObjectURL(file);
      const extractedColor = await extractColorFromImage(imageUrl);
      setSelectedColor(extractedColor);
      setCustomColor(extractedColor);
      URL.revokeObjectURL(imageUrl);
    } catch (error) {
      console.error("颜色提取失败:", error);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleReset = () => {
    setSelectedColor("#f4606c");
    setCustomColor("#f4606c");
    setCustomHex("");
    setUseDynamicTheme(false);
    setImageFile(null);
  };

  const handleApply = () => {
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <PaletteIcon />
            <Typography variant="h6">主题自定义</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* 动态主题开关 */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={useDynamicTheme}
                  onChange={handleDynamicThemeToggle}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1">启用动态主题</Typography>
                  <Typography variant="body2" color="text.secondary">
                    基于选择的颜色自动生成协调的配色方案
                  </Typography>
                </Box>
              }
            />
          </Box>

          {/* 当前颜色预览 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              当前主色调
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  backgroundColor: selectedColor,
                  border: `2px solid ${theme.palette.divider}`,
                }}
              />
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {selectedColor.toUpperCase()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {useDynamicTheme ? "动态主题已启用" : "静态主题"}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* 预设颜色 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              预设颜色
            </Typography>
            <Grid container spacing={1}>
              {Object.entries(PRESET_COLORS).map(([name, color]) => (
                // <Grid item key={name}>
                <Grid key={name}>
                  <Tooltip title={`${name}: ${color}`}>
                    <Paper
                      elevation={selectedColor === color ? 4 : 1}
                      sx={{
                        width: 40,
                        height: 40,
                        backgroundColor: color,
                        cursor: "pointer",
                        border:
                          selectedColor === color
                            ? `3px solid ${theme.palette.primary.main}`
                            : `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        transition: "all 0.2s ease",
                        "&:hover": {
                          transform: "scale(1.1)",
                          elevation: 3,
                        },
                      }}
                      onClick={() => handleColorSelect(color)}
                    />
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* 自定义十六进制颜色 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              自定义颜色
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="十六进制颜色代码"
              placeholder="#FF5722"
              value={customHex}
              onChange={handleCustomHexChange}
              helperText="输入格式: #RRGGBB"
              InputProps={{
                startAdornment:
                  customHex && /^#[0-9A-F]{6}$/i.test(customHex) ? (
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        backgroundColor: customHex,
                        border: `1px solid ${theme.palette.divider}`,
                        mr: 1,
                      }}
                    />
                  ) : null,
              }}
            />
          </Box>

          {/* 从图片提取颜色 */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              从图片提取颜色
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<PhotoIcon />}
                disabled={isExtracting}
              >
                {isExtracting ? "提取中..." : "选择图片"}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </Button>
              {imageFile && (
                <Chip
                  label={imageFile.name}
                  onDelete={() => setImageFile(null)}
                  size="small"
                />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              上传图片自动提取主色调作为主题颜色
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset} startIcon={<RefreshIcon />}>
          重置
        </Button>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleApply} variant="contained">
          应用
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 快速主题切换按钮组件
export const ThemeQuickToggle: React.FC = () => {
  const [open, setOpen] = useState(false);
  const _useDynamicTheme = useAppStore((state) => state.useDynamicTheme);

  return (
    <>
      <Tooltip title="主题自定义">
        <IconButton onClick={() => setOpen(true)} className="!text-white">
          <PaletteIcon />
        </IconButton>
      </Tooltip>
      <ThemeCustomizer open={open} onClose={() => setOpen(false)} />
    </>
  );
};
