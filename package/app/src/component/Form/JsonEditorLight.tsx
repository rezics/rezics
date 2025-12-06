import React, {useState, useMemo, useEffect} from 'react';
import {
  TextField,
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import PreviewIcon from '@mui/icons-material/Preview';
import EditIcon from '@mui/icons-material/Edit';

import {
  JsonView,
  allExpanded,
  collapseAllNested,
  defaultStyles,
} from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

interface JsonEditorLightProps {
  value?: any;
  onChange?: (value: any) => void;
}

export function JsonEditorLight({value, onChange}: JsonEditorLightProps) {
  const [tabIndex, setTabIndex] = useState(0);
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(value || {}, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  // 验证并解析 JSON
  const parsedJson = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText);
      setError(null);
      return parsed;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      return null;
    }
  }, [jsonText]);

  // 格式化 JSON
  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const formatted = JSON.stringify(parsed, null, 2);
      setJsonText(formatted);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  // 应用更改
  const handleApply = () => {
    if (parsedJson && onChange) {
      onChange(parsedJson);
    }
  };

  // 处理文本变化
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJsonText(e.target.value);
  };

  // 当 value 从外部更新时同步
  useEffect(() => {
    if (value !== parsedJson) {
      setJsonText(JSON.stringify(value || {}, null, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Box>
      <Paper sx={{borderRadius: 2, overflow: 'hidden'}}>
        <Box sx={{borderBottom: 1, borderColor: 'divider', display: 'flex'}}>
          <Tabs
            value={tabIndex}
            onChange={(_, newValue) => setTabIndex(newValue)}
            sx={{flex: 1}}
          >
            <Tab icon={<EditIcon />} label="编辑" iconPosition="start" />
            <Tab icon={<PreviewIcon />} label="预览" iconPosition="start" />
          </Tabs>
          <Box sx={{display: 'flex', alignItems: 'center', px: 2}}>
            <Tooltip title="格式化 JSON">
              <IconButton onClick={handleFormat} size="small" color="primary">
                <FormatAlignLeftIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 编辑模式 */}
        {tabIndex === 0 && (
          <Box sx={{p: 2}}>
            {error && (
              <Alert severity="error" sx={{mb: 2}}>
                <Typography variant="body2">JSON 解析错误: {error}</Typography>
              </Alert>
            )}
            <TextField
              fullWidth
              multiline
              rows={15}
              value={jsonText}
              onChange={handleTextChange}
              onBlur={handleApply}
              placeholder='{"key": "value"}'
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                },
              }}
              helperText={
                error
                  ? '请修复 JSON 错误'
                  : parsedJson && onChange
                  ? '失去焦点时自动保存'
                  : '输入有效的 JSON 格式'
              }
              error={!!error}
            />
          </Box>
        )}

        {/* 预览模式 */}
        {tabIndex === 1 && (
          <Box sx={{p: 2, backgroundColor: '#fafafa', minHeight: 400}}>
            {parsedJson ? (
              <JsonView
                data={parsedJson}
                shouldExpandNode={collapseAllNested}
                style={defaultStyles}
              />
            ) : (
              <Alert severity="warning">
                <Typography variant="body2">无法预览：JSON 格式无效</Typography>
              </Alert>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
