import {useState, useEffect} from 'react';
import type {FC} from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Stack,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import type {JwtServiceDTO, UpdateJwtServiceInput} from '@package/contract';

type Props = {
  open: boolean;
  service: JwtServiceDTO | null;
  onClose: () => void;
  onUpdate: (serviceKey: string, input: UpdateJwtServiceInput) => Promise<void>;
  onActivate: (serviceKey: string) => Promise<void>;
  onDeactivate: (serviceKey: string) => Promise<void>;
  updating: boolean;
  error: string | null;
};

export const JwtServiceEditDialog: FC<Props> = ({
  open,
  service,
  onClose,
  onUpdate,
  onActivate,
  onDeactivate,
  updating,
  error,
}) => {
  const [issuer, setIssuer] = useState('');
  const [audience, setAudience] = useState('');
  const [jwksUrl, setJwksUrl] = useState('');
  const [jwksPath, setJwksPath] = useState('');
  const [isLocalIssuer, setIsLocalIssuer] = useState(false);

  useEffect(() => {
    if (service) {
      setIssuer(service.issuer);
      setAudience(service.audience);
      setJwksUrl(service.jwksUrl);
      setJwksPath(service.jwksPath);
      setIsLocalIssuer(service.isLocalIssuer);
    }
  }, [service]);

  if (!service) return null;

  const handleSave = async () => {
    const input: UpdateJwtServiceInput = {};
    if (issuer !== service.issuer) input.issuer = issuer;
    if (audience !== service.audience) input.audience = audience;
    if (jwksUrl !== service.jwksUrl) input.jwksUrl = jwksUrl;
    if (jwksPath !== service.jwksPath) input.jwksPath = jwksPath;
    if (isLocalIssuer !== service.isLocalIssuer)
      input.isLocalIssuer = isLocalIssuer;

    await onUpdate(service.serviceKey, input);
  };

  const handleToggleActive = async () => {
    if (service.isActive) {
      await onDeactivate(service.serviceKey);
    } else {
      await onActivate(service.serviceKey);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit JWT Service: <strong>{service.serviceKey}</strong>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{mt: 1}}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip
              label={service.isActive ? 'Active' : 'Inactive'}
              color={service.isActive ? 'success' : 'default'}
              size="small"
            />
            <Button
              size="small"
              variant="outlined"
              color={service.isActive ? 'warning' : 'success'}
              onClick={handleToggleActive}
              disabled={updating}
            >
              {service.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </Stack>

          <Divider />

          <TextField
            label="Issuer"
            value={issuer}
            onChange={e => setIssuer(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Audience"
            value={audience}
            onChange={e => setAudience(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="JWKS URL"
            value={jwksUrl}
            onChange={e => setJwksUrl(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="JWKS Path"
            value={jwksPath}
            onChange={e => setJwksPath(e.target.value)}
            fullWidth
            size="small"
          />
          <FormControlLabel
            control={
              <Switch
                checked={isLocalIssuer}
                onChange={e => setIsLocalIssuer(e.target.checked)}
              />
            }
            label="Local Issuer"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={updating}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={updating}
        >
          {updating ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
