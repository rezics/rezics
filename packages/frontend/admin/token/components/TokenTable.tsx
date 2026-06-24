import type { ApiTokenDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
  const { t } = useTranslation(["admin", "common"]);
  const renderScopes = (scopes?: Record<string, string[]>) => {
    if (!scopes || Object.keys(scopes).length === 0) {
      return (
        <Badge variant="outline" className="text-xs">
          {t("admin:token_no_scopes")}
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
            <TableHead>{t("admin:auth_user_name")}</TableHead>
            <TableHead>{t("admin:token_scopes")}</TableHead>
            <TableHead>{t("common:created")}</TableHead>
            <TableHead>{t("common:expires")}</TableHead>
            <TableHead>{t("admin:token_revoked")}</TableHead>
            <TableHead className="text-right">
              {t("admin:auth_actions_title")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((token) => (
            <TableRow key={token.id}>
              <TableCell>{token.name}</TableCell>
              <TableCell>{renderScopes(token.scopes)}</TableCell>
              <TableCell>
                {token.createdAt
                  ? new Date(token.createdAt).toLocaleString()
                  : "-"}
              </TableCell>
              <TableCell>
                {token.expiresAt
                  ? new Date(token.expiresAt).toLocaleString()
                  : t("admin:token_never")}
              </TableCell>
              <TableCell>
                {token.revoked ? t("common:yes") : t("common:no")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-row gap-2 justify-end">
                  <Tooltip>
                    <TooltipTrigger
                      render={(props) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(token)}
                          disabled={token.revoked ?? false}
                          {...props}
                        >
                          <EditIcon className="size-4" />
                          {t("common:edit")}
                        </Button>
                      )}
                    />
                    <TooltipContent>{t("common:edit")}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={(props) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-error-text"
                          onClick={() => onRevoke(token.id)}
                          disabled={
                            (token.revoked ?? false) || !!revokingIds[token.id]
                          }
                          {...props}
                        >
                          {t("common:revoke")}
                        </Button>
                      )}
                    />
                    <TooltipContent>{t("common:revoke")}</TooltipContent>
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
