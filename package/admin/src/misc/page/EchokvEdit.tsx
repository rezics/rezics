import { useAlertStore } from "@app/state/windowAlertStore";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Button,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { echoKvApi } from "@rezics/api/echokv/echokv";
import { RezicsJsonEditor } from "@rezics/ui/editor";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

export const EchokvEditPage: React.FC = () => {
  const { show: showAlert } = useAlertStore();

  const [currentKey, setCurrentKey] = useState("key_name");
  const [searchKey, setSearchKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [_saving, setSaving] = useState(false);
  const [editorValue, setEditorValue] = useState("{}");

  const { data: keyList, isLoading: keyListLoading } = useQuery({
    queryKey: ["echokv-keys", searchKey],
    queryFn: () => echoKvApi.listKeys(searchKey),
    staleTime: 1000 * 60,
  });

  const handleLoad = async () => {
    if (!currentKey.trim()) return showAlert("请输入 key");

    setLoading(true);
    try {
      const res = await echoKvApi.get(currentKey.trim());
      const raw = res?.value;

      let parsed: { value: unknown };
      if (typeof raw === "string") {
        try {
          parsed = { value: JSON.parse(raw) };
        } catch {
          parsed = { value: raw };
        }
      } else {
        parsed = { value: raw ?? {} };
      }

      setEditorValue(JSON.stringify(parsed, null, 2));
      showAlert("加载成功");
    } catch (err) {
      showAlert(`加载失败：${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setEditorValue("{}");
  };

  const handleSave = async () => {
    if (!currentKey.trim()) return showAlert("请输入 key");

    setSaving(true);
    try {
      const dataObject = JSON.parse(editorValue);
      const value = dataObject.value;

      const result = await echoKvApi.set(currentKey.trim(), value);

      showAlert(`已保存: ${JSON.stringify(result)}`);
    } catch (err) {
      showAlert(`当前 JSON 非法：${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4, mb: 6, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        EchoKV JSON 编辑器
      </Typography>

      <Paper sx={{ mt: 2, borderRadius: 2, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Key 列表
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="搜索 Key"
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Box
            sx={{
              maxHeight: 260,
              overflow: "auto",
              borderRadius: 1,
              border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            {keyListLoading && (
              <Box sx={{ p: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  加载中…
                </Typography>
              </Box>
            )}
            {!keyListLoading &&
              (!keyList?.keys || keyList.keys.length === 0) && (
                <Box sx={{ p: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    暂无数据
                  </Typography>
                </Box>
              )}
            {!keyListLoading && keyList?.keys && keyList.keys.length > 0 && (
              <List dense disablePadding>
                {keyList.keys.map((key) => (
                  <ListItemButton
                    key={key}
                    selected={currentKey === key}
                    onClick={() => setCurrentKey(key)}
                  >
                    <ListItemText
                      primary={key}
                      primaryTypographyProps={{
                        noWrap: true,
                        title: key,
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ mt: 3, borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              size="small"
              label="Key"
              value={currentKey}
              onChange={(e) => setCurrentKey(e.target.value)}
              sx={{ minWidth: 260 }}
            />
            <Stack
              direction="row"
              spacing={1}
              flex={1}
              justifyContent="flex-end"
            >
              <Button
                variant="outlined"
                size="small"
                onClick={handleLoad}
                disabled={loading}
              >
                {loading ? "加载中…" : "加载"}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleClear}
                disabled={loading}
              >
                清空
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ p: 2 }} className="min-h-[500px]">
          <RezicsJsonEditor
            value={editorValue}
            onChange={setEditorValue}
            onSubmit={handleSave}
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default EchokvEditPage;
