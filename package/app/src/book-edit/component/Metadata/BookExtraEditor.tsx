import 'react-json-view-lite/dist/index.css';
import {JsonEditorLight} from '@rezics/ui/editor/jsoneditor/JsonEditorLight.tsx';
import React, {useEffect, useState} from 'react';
import {
  Button,
  Divider,
  IconButton,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {useTranslation} from 'react-i18next';

/** Book extra data structure. */
export type BookExtraData = {
  publishURL?: string[];
  [key: string]: unknown;
};

/** Props for BookExtraEditor component. */
interface BookExtraEditorProps {
  /** Current extra data value. */
  value?: BookExtraData | null;
  /** Callback when extra data changes. */
  onChange?: (value: BookExtraData) => void;
}

function PublishURL({value, onChange}: BookExtraEditorProps) {
  const {t} = useTranslation();
  const [newUrl, setNewUrl] = useState('');
  const urls: string[] = Array.isArray(value) ? value : [];

  const handleAdd = () => {
    if (newUrl.trim() && onChange) {
      const updatedUrls = [...urls, newUrl.trim()];
      onChange({...value, publishURL: updatedUrls});
      setNewUrl('');
    }
  };

  const handleRemove = (index: number) => {
    if (onChange) {
      const updatedUrls = urls.filter((_, i) => i !== index);
      onChange({...value, publishURL: updatedUrls});
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
        {t('book.extra.publish_urls.title')}
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
              aria-label={t('common.delete')}
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
          placeholder={t('placeholders.enter_url')}
          variant="outlined"
        />
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!newUrl.trim()}
          startIcon={<AddIcon />}
          sx={{minWidth: 100}}
        >
          {t('common.add')}
        </Button>
      </div>
    </Paper>
  );
}

/**
 * Book Extra Editor - Editor for book extra metadata.
 *
 * Provides UI for editing publish URLs and other extra JSON data.
 */
export const BookExtraEditor: React.FC<BookExtraEditorProps> = ({
  value,
  onChange,
}) => {
  const [extraData, setExtraData] = useState<BookExtraData>(value || {});

  useEffect(() => {
    setExtraData(value || {});
  }, [value]);

  const handleExtraChange = (newExtraData: BookExtraData) => {
    setExtraData(newExtraData);
    onChange?.(newExtraData);
  };

  const handlePublishURLChange = (publishURL: string[]) => {
    handleExtraChange({
      ...extraData,
      publishURL,
    });
  };

  return (
    <div>
      <PublishURL value={extraData || undefined} onChange={handleExtraChange} />
      <Divider sx={{my: 3}} />
      <JsonEditorLight value={extraData} onChange={handleExtraChange} />
    </div>
  );
};
