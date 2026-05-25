import { Badge, Button } from "@rezics/ui/shadcn";
import { Monitor as ComputerIcon } from "lucide-react";
import type { FC } from "react";
import { settings_security_unknown_device } from "@rezics/i18n/messages";

interface SessionListItemProps {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt?: string;
  };
  isCurrent: boolean;
  onRevoke: (token: string) => void;
  revoking?: boolean;
}

function parseUserAgent(ua?: string): string {
  if (!ua) return settings_security_unknown_device();
  const browser =
    ua.match(/(?:Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)[/ ]\S+/)?.[0] ??
    "";
  const os =
    ua.match(
      /(?:Windows NT [\d.]+|Mac OS X [\d._]+|Linux|Android [\d.]+|iOS [\d.]+)/,
    )?.[0] ?? "";
  if (browser || os) return [browser, os].filter(Boolean).join(" on ");
  return ua.slice(0, 60);
}

export const SessionListItem: FC<SessionListItemProps> = ({
  session,
  isCurrent,
  onRevoke,
  revoking,
}) => {
  const userAgent = parseUserAgent(session.userAgent);
  const createdAt = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="flex items-center gap-3 py-3">
      <ComputerIcon className="text-text-secondary" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{userAgent}</span>
          {isCurrent && (
            <Badge variant="outline" className="text-text-brand">
              Current session
            </Badge>
          )}
        </div>
        <p className="text-xs text-text-secondary">
          {[session.ipAddress, createdAt].filter(Boolean).join(" · ")}
        </p>
      </div>
      {!isCurrent && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRevoke(session.token)}
          disabled={revoking}
          className="text-error-text"
        >
          Revoke
        </Button>
      )}
    </div>
  );
};
