import type { JwtServiceDTO, UpdateJwtServiceInput } from "@rezics/contract";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  admin_jwt_activate,
  admin_jwt_audience,
  admin_jwt_deactivate,
  admin_jwt_edit_title,
  admin_jwt_issuer,
  admin_jwt_jwks_path,
  admin_jwt_jwks_url,
  admin_jwt_local_issuer,
  admin_jwt_saving,
  common_active,
  common_cancel,
  common_inactive,
  common_save,
} from "@rezics/i18n/messages";
const m = {
  admin_jwt_activate,
  admin_jwt_audience,
  admin_jwt_deactivate,
  admin_jwt_edit_title,
  admin_jwt_issuer,
  admin_jwt_jwks_path,
  admin_jwt_jwks_url,
  admin_jwt_local_issuer,
  admin_jwt_saving,
  common_active,
  common_cancel,
  common_inactive,
  common_save,
};

const i18nMessages = {
  admin_jwt_activate,
  admin_jwt_audience,
  admin_jwt_deactivate,
  admin_jwt_edit_title,
  admin_jwt_issuer,
  admin_jwt_jwks_path,
  admin_jwt_jwks_url,
  admin_jwt_local_issuer,
  admin_jwt_saving,
  common_active,
  common_cancel,
  common_inactive,
  common_save,
};

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
  const m = useMessage(i18nMessages);
  const [issuer, setIssuer] = useState("");
  const [audience, setAudience] = useState("");
  const [jwksUrl, setJwksUrl] = useState("");
  const [jwksPath, setJwksPath] = useState("");
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
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {m.admin_jwt_edit_title({ serviceKey: service.serviceKey })}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-1">
          {error && (
            <Alert>
              <AlertDescription className="text-error-text">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-row items-center gap-2">
            <Badge
              className={
                service.isActive
                  ? "bg-success-fill text-white"
                  : "bg-surface-elevated text-text-secondary"
              }
            >
              {service.isActive ? m.common_active() : m.common_inactive()}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className={
                service.isActive ? "text-warning-text" : "text-success-text"
              }
              onClick={handleToggleActive}
              disabled={updating}
            >
              {service.isActive
                ? m.admin_jwt_deactivate()
                : m.admin_jwt_activate()}
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col gap-1">
            <Label htmlFor="jsed-issuer">{m.admin_jwt_issuer()}</Label>
            <Input
              id="jsed-issuer"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="jsed-aud">{m.admin_jwt_audience()}</Label>
            <Input
              id="jsed-aud"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="jsed-url">{m.admin_jwt_jwks_url()}</Label>
            <Input
              id="jsed-url"
              value={jwksUrl}
              onChange={(e) => setJwksUrl(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="jsed-path">{m.admin_jwt_jwks_path()}</Label>
            <Input
              id="jsed-path"
              value={jwksPath}
              onChange={(e) => setJwksPath(e.target.value)}
              className="h-8"
            />
          </div>
          <Label className="flex flex-row items-center gap-2 cursor-pointer">
            <Checkbox
              checked={isLocalIssuer}
              onCheckedChange={(v) => setIsLocalIssuer(Boolean(v))}
            />
            {m.admin_jwt_local_issuer()}
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updating}>
            {m.common_cancel()}
          </Button>
          <Button onClick={handleSave} disabled={updating}>
            {updating ? m.admin_jwt_saving() : m.common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
