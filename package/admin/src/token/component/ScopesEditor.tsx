import {useState} from 'react';
import type {FC} from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

interface ScopesEditorProps {
  scopes: Record<string, string[]>;
  onChange: (scopes: Record<string, string[]>) => void;
}

/**
 * 预定义的 scope 域和权限选项
 */
const PREDEFINED_DOMAINS = [
  'main',
  'book',
  'chapter',
  'user',
  'comment',
  'tag',
  'review',
  'readlist',
];
const PREDEFINED_PERMISSIONS = ['read', 'write', 'delete', 'admin'];

/**
 * ScopesEditor - 编辑 API token 权限 (scopes) 的组件
 */
export const ScopesEditor: FC<ScopesEditorProps> = ({scopes, onChange}) => {
  const [newDomain, setNewDomain] = useState('');
  const [newPermission, setNewPermission] = useState('');
  const [customDomain, setCustomDomain] = useState('');

  const addScope = () => {
    const domain = newDomain === 'custom' ? customDomain : newDomain;
    if (!domain || !newPermission) return;

    const updated = {...scopes};
    if (!updated[domain]) {
      updated[domain] = [];
    }
    if (!updated[domain].includes(newPermission)) {
      updated[domain] = [...updated[domain], newPermission];
    }
    onChange(updated);
    setNewPermission('');
  };

  const removeScope = (domain: string, permission: string) => {
    const updated = {...scopes};
    if (updated[domain]) {
      updated[domain] = updated[domain].filter(p => p !== permission);
      if (updated[domain].length === 0) {
        delete updated[domain];
      }
    }
    onChange(updated);
  };

  const removeDomain = (domain: string) => {
    const updated = {...scopes};
    delete updated[domain];
    onChange(updated);
  };

  return (
    <Box>
      <Typography variant="subtitle1" className="mb-2 font-medium">
        Permissions (Scopes)
      </Typography>

      {/* 显示当前 scopes */}
      {Object.keys(scopes).length > 0 && (
        <Paper variant="outlined" className="p-3 mb-4">
          {Object.entries(scopes).map(([domain, permissions]) => (
            <Box key={domain} className="mb-2">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" className="font-medium min-w-20">
                  {domain}:
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {permissions.map(perm => (
                    <Chip
                      key={`${domain}:${perm}`}
                      label={perm}
                      size="small"
                      color="primary"
                      onDelete={() => removeScope(domain, perm)}
                    />
                  ))}
                </Stack>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removeDomain(domain)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>
          ))}
        </Paper>
      )}

      {/* 添加新 scope */}
      <Stack direction="row" spacing={2} alignItems="flex-end">
        <FormControl size="small" sx={{minWidth: 120}}>
          <InputLabel>Domain</InputLabel>
          <Select
            value={newDomain}
            label="Domain"
            onChange={e => setNewDomain(e.target.value)}
          >
            {PREDEFINED_DOMAINS.map(d => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
            <MenuItem value="custom">Custom...</MenuItem>
          </Select>
        </FormControl>

        {newDomain === 'custom' && (
          <TextField
            size="small"
            label="Custom domain"
            value={customDomain}
            onChange={e => setCustomDomain(e.target.value)}
          />
        )}

        <FormControl size="small" sx={{minWidth: 120}}>
          <InputLabel>Permission</InputLabel>
          <Select
            value={newPermission}
            label="Permission"
            onChange={e => setNewPermission(e.target.value)}
          >
            {PREDEFINED_PERMISSIONS.map(p => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={addScope}
          disabled={
            !newDomain ||
            !newPermission ||
            (newDomain === 'custom' && !customDomain)
          }
        >
          Add
        </Button>
      </Stack>

      {Object.keys(scopes).length === 0 && (
        <Typography variant="body2" color="textSecondary" className="mt-2">
          No scopes defined. Token will have default permissions.
        </Typography>
      )}
    </Box>
  );
};

export default ScopesEditor;
