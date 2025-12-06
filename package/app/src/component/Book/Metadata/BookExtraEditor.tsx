import 'react-json-view-lite/dist/index.css';
import {JsonEditorLight} from '@/component/Form/JsonEditorLight';
import React, {useState, useEffect} from 'react';
import {
  TextField,
  Button,
  IconButton,
  Link,
  Typography,
  Paper,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

interface BookExtraEditorProps {
  value?: any;
  onChange?: (value: any) => void;
}

function PublishURL({value, onChange}: BookExtraEditorProps) {
  const [newUrl, setNewUrl] = useState('');
  const urls: string[] = Array.isArray(value) ? value : [];

  const handleAdd = () => {
    if (newUrl.trim() && onChange) {
      const updatedUrls = [...urls, newUrl.trim()];
      onChange(updatedUrls);
      setNewUrl('');
    }
  };

  const handleRemove = (index: number) => {
    if (onChange) {
      const updatedUrls = urls.filter((_, i) => i !== index);
      onChange(updatedUrls);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Paper sx={{p: 2, borderRadius: 2}}>
      <Typography variant="h6" sx={{mb: 2}}>
        发布链接 (Publish URLs)
      </Typography>

      <div className="space-y-2">
        {urls.map((url, index) => (
          <Paper
            key={index}
            variant="outlined"
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Link
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {url}
            </Link>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleRemove(index)}
              aria-label="删除"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Paper>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <TextField
          fullWidth
          size="small"
          type="url"
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入 URL 地址"
          variant="outlined"
        />
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!newUrl.trim()}
          startIcon={<AddIcon />}
          sx={{minWidth: 100}}
        >
          添加
        </Button>
      </div>
    </Paper>
  );
}

export function BookExtraEditor({value, onChange}: BookExtraEditorProps) {
  // 创建中间状态来管理 extra 对象
  const [extraData, setExtraData] = useState<any>(value || {});

  // 当外部 value 变化时同步到内部状态
  useEffect(() => {
    setExtraData(value || {});
  }, [value]);

  // 当内部状态变化时通知外部
  const handleExtraChange = (newExtraData: any) => {
    setExtraData(newExtraData);
    if (onChange) {
      onChange(newExtraData);
    }
  };

  // 处理 PublishURL 的变化
  const handlePublishURLChange = (publishURL: string[]) => {
    const newExtraData = {
      ...extraData,
      publishURL,
    };
    handleExtraChange(newExtraData);
  };

  // 处理 JsonEditor 的变化
  const handleJsonChange = (newValue: any) => {
    handleExtraChange(newValue);
  };

  return (
    <div>
      <PublishURL
        value={extraData?.publishURL}
        onChange={handlePublishURLChange}
      />

      <Divider sx={{my: 3}} />

      <JsonEditorLight value={extraData} onChange={handleJsonChange} />
    </div>
  );
}
