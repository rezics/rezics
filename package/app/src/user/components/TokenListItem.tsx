import type { ApiTokenDTO } from "@rezics/contract";
import { Badge, Button } from "@rezics/ui/shadcn";
import { Key as KeyIcon } from "lucide-react";
import type { FC } from "react";

interface TokenListItemProps {
  token: ApiTokenDTO;
  onEdit: (token: ApiTokenDTO) => void;
  onRevoke: (id: string) => void;
}

export const TokenListItem: FC<TokenListItemProps> = ({
  token,
  onEdit,
  onRevoke,
}) => {
  const scopeLabels = formatScopes(token.scopes);

  return (
    <div className="flex items-start gap-3 py-3">
      <KeyIcon className="mt-0.5 text-text-secondary" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{token.name}</span>
        {scopeLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {scopeLabels.map((scope) => (
              <Badge key={scope} variant="outline">
                {scope}
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-1 block text-xs text-text-secondary">
          Created {formatDate(token.createdAt)}
          {token.expiresAt && ` · Expires ${formatDate(token.expiresAt)}`}
          {token.lastUsedAt && ` · Last used ${formatDate(token.lastUsedAt)}`}
          {token.lastIP && ` from ${token.lastIP}`}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="ghost" onClick={() => onEdit(token)}>
          Edit
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onRevoke(token.id)}
        >
          Revoke
        </Button>
      </div>
    </div>
  );
};

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatScopes(scopes?: Record<string, string[]>): string[] {
  if (!scopes) return [];
  return Object.entries(scopes).flatMap(([domain, perms]) =>
    perms.map((p) => `${domain}:${p}`),
  );
}
