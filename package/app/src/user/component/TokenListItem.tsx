import { Button, Chip, Typography } from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import type { ApiTokenDTO } from '@rezics/contract';
import type { FC } from 'react';

interface TokenListItemProps {
  token: ApiTokenDTO;
  onEdit: (token: ApiTokenDTO) => void;
  onRevoke: (id: string) => void;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatScopes(scopes?: Record<string, string[]>): string[] {
  if (!scopes) return [];
  return Object.entries(scopes).flatMap(([domain, perms]) =>
    perms.map((p) => `${domain}:${p}`),
  );
}

export const TokenListItem: FC<TokenListItemProps> = ({
  token,
  onEdit,
  onRevoke,
}) => {
  const scopeLabels = formatScopes(token.scopes);

  return (
    <div className="flex items-start gap-3 py-3">
      <KeyIcon color="action" className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <Typography variant="body2" className="font-medium">
          {token.name}
        </Typography>
        {scopeLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {scopeLabels.map((scope) => (
              <Chip key={scope} label={scope} size="small" variant="outlined" />
            ))}
          </div>
        )}
        <Typography variant="caption" color="text.secondary" className="mt-1 block">
          Created {formatDate(token.createdAt)}
          {token.expiresAt && ` \u00b7 Expires ${formatDate(token.expiresAt)}`}
          {token.lastUsedAt && ` \u00b7 Last used ${formatDate(token.lastUsedAt)}`}
          {token.lastIP && ` from ${token.lastIP}`}
        </Typography>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="small" onClick={() => onEdit(token)}>
          Edit
        </Button>
        <Button
          size="small"
          color="error"
          onClick={() => onRevoke(token.id)}
        >
          Revoke
        </Button>
      </div>
    </div>
  );
};
