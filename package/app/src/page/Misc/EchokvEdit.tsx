import {useEffect, useRef, useState} from 'react';
import type React from 'react';
import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {echoKvApi} from '@/api/echokv/echokv';
import {useAlertStore} from '@/global/windowAlertStore';
import {JSONEditor, type JSONEditorConfig} from '@pardnchiu/nanojson';

type JSONEditorInstance = JSONEditor;

export const EchokvEditPage: React.FC = () => {
  const {show: showAlert} = useAlertStore();

  const [currentKey, setCurrentKey] = useState('home_notice');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<JSONEditorInstance | null>(null);

  // 初始化一次，不依赖 React 的 DOM 变动
  useEffect(() => {
    const config: JSONEditorConfig = {
      id: 'nanojson-editor',
      title: 'JSON 编辑器',
      description: '编辑 EchoKV JSON 值',
      css: '/css/NanoJSON.css',
      fill: 0,
      button: {
        import: true,
        export: true,
        reset: true,
      },
    };

    editorRef.current = new JSONEditor(config);

    return () => {
      editorRef.current = null; // 不 destroy，让 React 卸载 DOM
    };
  }, []);

  // 加载
  const handleLoad = async () => {
    if (!editorRef.current) return;
    if (!currentKey.trim()) return showAlert('请输入 key');

    setLoading(true);
    try {
      const res = await echoKvApi.get(currentKey.trim());
      const raw = res?.value;

      let parsed;
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = {value: raw};
        }
      } else {
        parsed = raw ?? {};
      }

      await editorRef.current.import(parsed); // 自动渲染
      showAlert('加载成功');
    } catch (err) {
      showAlert(`加载失败：${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // 保存
  const handleSave = async () => {
    if (!editorRef.current) return;
    if (!currentKey.trim()) return showAlert('请输入 key');

    setSaving(true);
    try {
      const jsonText = editorRef.current.json; // ★ 一次性获取最终 JSON 字符串
      JSON.parse(jsonText); // 校验

      // await echoKvApi.set(currentKey.trim(), jsonText);

      showAlert('已保存');
    } catch (err) {
      showAlert(`当前 JSON 非法：${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{maxWidth: 1200, mx: 'auto', mt: 4, mb: 6, px: 2}}>
      <Typography variant="h4" gutterBottom>
        EchoKV JSON 编辑器
      </Typography>

      <Paper sx={{mt: 3, borderRadius: 2, overflow: 'hidden'}}>
        <Box sx={{px: 2, py: 1.5}}>
          <Stack direction={{xs: 'column', sm: 'row'}} spacing={1.5}>
            <TextField
              size="small"
              label="Key"
              value={currentKey}
              onChange={e => setCurrentKey(e.target.value)}
              sx={{minWidth: 260}}
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
                {loading ? '加载中…' : '加载'}
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '保存中…' : '保存'}
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Divider />

        {/* 只提供一个静态 div，不让 React 控制内部 DOM */}
        <Box sx={{p: 2}}>
          <div id="nanojson-editor" className="min-h-[500px]" />
        </Box>
      </Paper>
    </Box>
  );
};

export default EchokvEditPage;
