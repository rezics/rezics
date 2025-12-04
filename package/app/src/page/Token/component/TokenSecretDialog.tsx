import type {FC} from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface TokenSecretDialogProps {
  open: boolean;
  secret: string | null;
  onClose: () => void;
}

/**
 * TokenSecretDialog - 显示新创建的 token secret（仅显示一次）
 */
export const TokenSecretDialog: FC<TokenSecretDialogProps> = ({
  open,
  secret,
  onClose,
}) => {
  const copyToClipboard = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
    } catch (_) {
      // ignore
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Token Created — Copy & Store</DialogTitle>
      <DialogContent>
        <Box className="mt-2">
          <Alert severity="warning">
            This token value is only shown once. Be sure to copy and store it
            securely.
          </Alert>

          <Box className="mt-4 flex items-center justify-between">
            <Typography
              variant="body1"
              component="pre"
              style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}
            >
              {secret}
            </Typography>
            <IconButton onClick={copyToClipboard}>
              <ContentCopyIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TokenSecretDialog;
