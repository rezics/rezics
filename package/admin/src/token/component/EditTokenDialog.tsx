import {useState, useEffect} from 'react';
import type {FC} from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
} from '@mui/material';
import type {ApiTokenDTO, UpdateApiTokenInput} from '@rezics/contract';
import {ScopesEditor} from './ScopesEditor';

interface EditTokenDialogProps {
  open: boolean;
  token: ApiTokenDTO | null;
  onClose: () => void;
  onUpdate: (id: string, input: UpdateApiTokenInput) => Promise<void>;
  updating: boolean;
  error: string | null;
}

/**
 * EditTokenDialog - 编辑 API token 的对话框（更新名称、权限、过期时间等）
 */
export const EditTokenDialog: FC<EditTokenDialogProps> = ({
  open,
  token,
  onClose,
  onUpdate,
  updating,
  error,
}) => {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [scopes, setScopes] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (token) {
      setName(token.name);
      // 处理 expiresAt 为 datetime-local 格式
      if (token.expiresAt) {
        const date = new Date(token.expiresAt);
        // 格式化为 datetime-local 输入格式: YYYY-MM-DDTHH:mm
        const formatted = date.toISOString().slice(0, 16);
        setExpiresAt(formatted);
      } else {
        setExpiresAt('');
      }
      setScopes(token.scopes ?? {});
    }
  }, [token]);

  const handleUpdate = async () => {
    if (!token) return;

    const input: UpdateApiTokenInput = {
      name: name || token.name,
      scopes,
      expiresAt: expiresAt || null,
    };
    await onUpdate(token.id, input);
  };

  const handleClose = () => {
    setName('');
    setExpiresAt('');
    setScopes({});
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit API Token</DialogTitle>
      <DialogContent>
        <Box className="space-y-4 mt-2">
          <TextField
            fullWidth
            label="Token name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <div className="my-6" />
          <TextField
            fullWidth
            type="datetime-local"
            label="Expires At (optional)"
            InputLabelProps={{shrink: true}}
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
          />
          <div className="my-6" />
          <ScopesEditor scopes={scopes} onChange={setScopes} />
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          color="primary"
          disabled={updating}
        >
          {updating ? 'Updating…' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditTokenDialog;
