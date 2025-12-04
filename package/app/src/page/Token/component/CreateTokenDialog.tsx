import {useState} from 'react';
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
import type {CreateApiTokenInput} from '@package/contract';
import {ScopesEditor} from './ScopesEditor';

interface CreateTokenDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateApiTokenInput) => Promise<void>;
  creating: boolean;
  error: string | null;
}

/**
 * CreateTokenDialog - 创建新 API token 的对话框
 */
export const CreateTokenDialog: FC<CreateTokenDialogProps> = ({
  open,
  onClose,
  onCreate,
  creating,
  error,
}) => {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [scopes, setScopes] = useState<Record<string, string[]>>({});

  const handleCreate = async () => {
    const input: CreateApiTokenInput = {
      name: name || 'New Token',
      ...(expiresAt ? {expiresAt} : {}),
      ...(Object.keys(scopes).length > 0 ? {scopes} : {}),
    };
    await onCreate(input);
  };

  const handleClose = () => {
    setName('');
    setExpiresAt('');
    setScopes({});
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Create API Token</DialogTitle>
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
          onClick={handleCreate}
          variant="contained"
          color="primary"
          disabled={creating}
        >
          {creating ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateTokenDialog;
