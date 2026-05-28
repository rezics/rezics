import type { JwtServiceDTO, UpdateJwtServiceInput } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
  const { t } = useTranslation(["admin", "common"]);
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
            {t("admin:jwt_edit_title", { serviceKey: service.serviceKey })}
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
              {service.isActive ? t("common:active") : t("common:inactive")}
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
                ? t("admin:jwt_deactivate")
                : t("admin:jwt_activate")}
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col gap-1">
            <Label htmlFor="jsed-issuer">{t("admin:jwt_issuer")}</Label>
            <Input
              id="jsed-issuer"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="jsed-aud">{t("admin:jwt_audience")}</Label>
            <Input
              id="jsed-aud"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="jsed-url">{t("admin:jwt_jwks_url")}</Label>
            <Input
              id="jsed-url"
              value={jwksUrl}
              onChange={(e) => setJwksUrl(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="jsed-path">{t("admin:jwt_jwks_path")}</Label>
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
            {t("admin:jwt_local_issuer")}
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updating}>
            {t("common:cancel")}
          </Button>
          <Button onClick={handleSave} disabled={updating}>
            {updating ? t("admin:jwt_saving") : t("common:save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
