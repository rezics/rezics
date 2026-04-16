import { Button, Chip, Typography } from '@mui/material';
import type { AuthProvider } from '@rezics/contract';
import type { ComponentType, FC } from 'react';

interface ProviderCardProps {
  providerId: AuthProvider['id'];
  name: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  connected: boolean;
  isPrimary: boolean;
  onConnect: () => void;
  connecting?: boolean;
}

export const ProviderCard: FC<ProviderCardProps> = ({
  name,
  icon: Icon,
  connected,
  isPrimary,
  onConnect,
  connecting,
}) => (
  <div className="flex items-center gap-3 py-3">
    <Icon size={24} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <Typography variant="body2" className="font-medium">
          {name}
        </Typography>
        {connected && (
          <Chip
            label="Connected"
            size="small"
            color="success"
            variant="outlined"
          />
        )}
        {isPrimary && (
          <Chip label="Primary" size="small" color="primary" variant="outlined" />
        )}
      </div>
    </div>
    {!connected && (
      <Button
        size="small"
        variant="outlined"
        onClick={onConnect}
        disabled={connecting}
      >
        Connect
      </Button>
    )}
  </div>
);
