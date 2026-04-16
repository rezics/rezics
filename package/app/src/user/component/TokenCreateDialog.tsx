import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useCreateTokenMutation } from '@rezics/api/token/token.mutations';
import type { ApiTokenScopes } from '@rezics/contract';
import { type FC, useState } from 'react';

const AVAILABLE_SCOPES = [
  { domain: 'user', perm: 'read', label: 'user:read' },
  { domain: 'user', perm: 'write', label: 'user:write' },
  { domain: 'dispatch', perm: 'rezics-server-session', label: 'dispatch:rezics-server-session' },
] as const;

interface TokenCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export const TokenCreateDialog: FC<TokenCreateDialogProps> = ({
  open,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState('');
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createToken = useCreateTokenMutation();

  const handleToggleScope = (label: string) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleCreate = () => {
    const scopes: ApiTokenScopes = {};
    for (const s of AVAILABLE_SCOPES) {
      if (selectedScopes.has(s.label)) {
        if (!scopes[s.domain]) scopes[s.domain] = [];
        scopes[s.domain].push(s.perm);
      }
    }

    createToken.mutate(
      {
        name,
        scopes: Object.keys(scopes).length > 0 ? scopes : undefined,
        expiresAt: expiresAt || undefined,
      },
      {
        onSuccess: (data) => {
          setRawToken(data.token);
        },
      },
    );
  };

  const handleCopy = async () => {
    if (!rawToken) return;
    await navigator.clipboard.writeText(rawToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName('');
    setSelectedScopes(new Set());
    setExpiresAt('');
    setRawToken(null);
    setCopied(false);
    createToken.reset();
    onClose();
  };

  if (rawToken) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Token Created</DialogTitle>
        <DialogContent>
          <Alert severity="warning" className="mb-4">
            Make sure to copy your token now. You won't be able to see it again.
          </Alert>
          <div className="flex items-center gap-2 p-3 rounded bg-[var(--mui-palette-action-hover)] font-mono text-sm break-all">
            <span className="flex-1">{rawToken}</span>
            <IconButton size="small" onClick={handleCopy}>
              {copied ? (
                <CheckIcon fontSize="small" color="success" />
              ) : (
                <ContentCopyIcon fontSize="small" />
              )}
            </IconButton>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate New Token</DialogTitle>
      <DialogContent>
        {createToken.error && (
          <Alert severity="error" className="mb-4">
            {createToken.error.message}
          </Alert>
        )}
        <div className="space-y-4 pt-2">
          <TextField
            fullWidth
            label="Token Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            variant="standard"
            required
            placeholder="e.g. CI Pipeline"
          />

          <div>
            <Typography variant="body2" className="font-medium mb-2">
              Scopes
            </Typography>
            {AVAILABLE_SCOPES.map((s) => (
              <FormControlLabel
                key={s.label}
                control={
                  <Checkbox
                    size="small"
                    checked={selectedScopes.has(s.label)}
                    onChange={() => handleToggleScope(s.label)}
                  />
                }
                label={<Typography variant="body2">{s.label}</Typography>}
              />
            ))}
          </div>

          <TextField
            fullWidth
            label="Expiration Date (optional)"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            variant="standard"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!name || createToken.isPending}
        >
          {createToken.isPending ? 'Creating...' : 'Generate Token'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
