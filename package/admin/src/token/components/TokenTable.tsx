import {
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import type { ApiTokenDTO } from "@rezics/contract";
import type { FC } from "react";
import { Pencil as EditIcon } from "lucide-react";

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
      return <Chip label="No scopes" size="small" variant="outlined" />;
    }
    return (
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {Object.entries(scopes).map(([domain, perms]) =>
          perms.map((perm) => (
            <Chip
              key={`${domain}:${perm}`}
              label={`${domain}:${perm}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )),
        )}
      </Stack>
    );
  };

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Scopes</TableCell>
          <TableCell>Created</TableCell>
          <TableCell>Expires</TableCell>
          <TableCell>Revoked</TableCell>
          <TableCell align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {tokens.map((t) => (
          <TableRow key={t.id} hover>
            <TableCell>{t.name}</TableCell>
            <TableCell>{renderScopes(t.scopes)}</TableCell>
            <TableCell>
              {t.createdAt ? new Date(t.createdAt).toLocaleString() : "-"}
            </TableCell>
            <TableCell>
              {t.expiresAt ? new Date(t.expiresAt).toLocaleString() : "Never"}
            </TableCell>
            <TableCell>{t.revoked ? "Yes" : "No"}</TableCell>
            <TableCell align="right">
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Tooltip title="Edit">
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => onEdit(t)}
                    disabled={t.revoked ?? false}
                    startIcon={<EditIcon />}
                  >
                    Edit
                  </Button>
                </Tooltip>
                <Tooltip title="Revoke">
                  <Button
                    size="small"
                    color="error"
                    onClick={() => onRevoke(t.id)}
                    disabled={(t.revoked ?? false) || !!revokingIds[t.id]}
                  >
                    Revoke
                  </Button>
                </Tooltip>
              </Stack>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default TokenTable;
