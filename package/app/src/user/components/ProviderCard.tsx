import type { AuthProvider } from "@rezics/contract";
import { Badge, Button } from "@rezics/ui/shadcn";
import type { ComponentType, FC } from "react";

interface ProviderCardProps {
  providerId: AuthProvider["id"];
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
        <span className="text-sm font-medium">{name}</span>
        {connected && (
          <Badge variant="outline" className="text-rezics-color-success">
            Connected
          </Badge>
        )}
        {isPrimary && (
          <Badge variant="outline" className="text-rezics-color-primary">
            Primary
          </Badge>
        )}
      </div>
    </div>
    {!connected && (
      <Button
        size="sm"
        variant="outline"
        onClick={onConnect}
        disabled={connecting}
      >
        Connect
      </Button>
    )}
  </div>
);
