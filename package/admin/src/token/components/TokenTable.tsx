import type { ApiTokenDTO } from "@rezics/contract";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { Pencil as EditIcon } from "lucide-react";
import type { FC } from "react";
import * as m from "@rezics/i18n/messages";

interface TokenTableProps {
  tokens: ApiTokenDTO[];
  revokingIds: Record<string, boolean>;
  onRevoke: (id: string) => void;
  onEdit: (token: ApiTokenDTO) => void;
}

/**
 * TokenTable - 展示 API tokens 列表
 */
export const TokenTable: FC<TokenTableProps> = ({
  tokens,
  revokingIds,
  onRevoke,
  onEdit,
}) => {
  const renderScopes = (scopes?: Record<string, string[]>) => {
    if (!scopes || Object.keys(scopes).length === 0) {
      return (
        <Badge variant="outline" className="text-xs">
          {m.admin_token_no_scopes()}
        </Badge>
      );
    }
    return (
      <div className="flex flex-row flex-wrap gap-1">
        {Object.entries(scopes).map(([domain, perms]) =>
          perms.map((perm) => (
            <Badge
              key={`${domain}:${perm}`}
              variant="outline"
              className="text-xs border-brand-fill text-text-brand"
            >
              {domain}:{perm}
            </Badge>
          )),
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.admin_auth_user_name()}</TableHead>
            <TableHead>{m.admin_token_scopes()}</TableHead>
            <TableHead>{m.common_created()}</TableHead>
            <TableHead>{m.common_expires()}</TableHead>
            <TableHead>{m.admin_token_revoked()}</TableHead>
            <TableHead className="text-right">
              {m.admin_auth_actions_title()}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.name}</TableCell>
              <TableCell>{renderScopes(t.scopes)}</TableCell>
              <TableCell>
                {t.createdAt ? new Date(t.createdAt).toLocaleString() : "-"}
              </TableCell>
              <TableCell>
                {t.expiresAt
                  ? new Date(t.expiresAt).toLocaleString()
                  : m.admin_token_never()}
              </TableCell>
              <TableCell>
                {t.revoked ? m.common_yes() : m.common_no()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-row gap-2 justify-end">
                  <Tooltip>
                    <TooltipTrigger
                      render={(props) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(t)}
                          disabled={t.revoked ?? false}
                          {...props}
                        >
                          <EditIcon className="size-4" />
                          {m.common_edit()}
                        </Button>
                      )}
                    />
                    <TooltipContent>{m.common_edit()}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={(props) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-error-text"
                          onClick={() => onRevoke(t.id)}
                          disabled={(t.revoked ?? false) || !!revokingIds[t.id]}
                          {...props}
                        >
                          {m.common_revoke()}
                        </Button>
                      )}
                    />
                    <TooltipContent>{m.common_revoke()}</TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
};

export default TokenTable;
