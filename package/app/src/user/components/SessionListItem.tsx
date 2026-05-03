import { Button, Chip, Typography } from "@mui/material";
import type { FC } from "react";
import { Monitor as ComputerIcon } from "lucide-react";

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
  if (!ua) return "Unknown device";
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
      <ComputerIcon color="action" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Typography variant="body2" className="font-medium truncate">
            {userAgent}
          </Typography>
          {isCurrent && (
            <Chip
              label="Current session"
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </div>
        <Typography variant="caption" color="text.secondary">
          {[session.ipAddress, createdAt].filter(Boolean).join(" \u00b7 ")}
        </Typography>
      </div>
      {!isCurrent && (
        <Button
          size="small"
          color="error"
          variant="outlined"
          onClick={() => onRevoke(session.token)}
          disabled={revoking}
        >
          Revoke
        </Button>
      )}
    </div>
  );
};
