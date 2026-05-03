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
          No scopes
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
              className="text-xs border-rezics-color-primary text-rezics-color-primary"
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
            <TableHead>Name</TableHead>
            <TableHead>Scopes</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Revoked</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
                  : "Never"}
              </TableCell>
              <TableCell>{t.revoked ? "Yes" : "No"}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-row gap-2 justify-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(t)}
                        disabled={t.revoked ?? false}
                      >
                        <EditIcon className="size-4" />
                        Edit
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rezics-color-danger"
                        onClick={() => onRevoke(t.id)}
                        disabled={
                          (t.revoked ?? false) || !!revokingIds[t.id]
                        }
                      >
                        Revoke
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Revoke</TooltipContent>
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
