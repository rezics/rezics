import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import {
  useRevokeTokenMutation,
  useUpdateTokenMutation,
} from "@rezics/api/token/token.mutations";
import { tokenQueries } from "@rezics/api/token/token.queries";
import type { ApiTokenDTO, ApiTokenScopes } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { SettingsSection } from "@/user/components/SettingsSection";
import { TokenCreateDialog } from "@/user/components/TokenCreateDialog";
import { TokenListItem } from "@/user/components/TokenListItem";
import { useRequireAuth } from "@/user/pages/useAuth";
import { Plus as AddIcon } from "lucide-react";

const AVAILABLE_SCOPES = [
  { domain: "user", perm: "read", label: "user:read" },
  { domain: "user", perm: "write", label: "user:write" },
  {
    domain: "dispatch",
    perm: "rezics-server-session",
    label: "dispatch:rezics-server-session",
  },
] as const;

function scopesToSet(scopes?: Record<string, string[]>): Set<string> {
  if (!scopes) return new Set();
  const set = new Set<string>();
  for (const [domain, perms] of Object.entries(scopes)) {
    for (const p of perms) set.add(`${domain}:${p}`);
  }
  return set;
}

function setToScopes(set: Set<string>): ApiTokenScopes {
  const scopes: ApiTokenScopes = {};
  for (const label of set) {
    const [domain, ...rest] = label.split(":");
    const perm = rest.join(":");
    if (!scopes[domain]) scopes[domain] = [];
    scopes[domain].push(perm);
  }
  return scopes;
}

export const SettingsTokensSection: FC = () => {
  useRequireAuth();

  const { data, isLoading } = useQuery(tokenQueries.list());
  const updateToken = useUpdateTokenMutation();
  const revokeToken = useRevokeTokenMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [editToken, setEditToken] = useState<ApiTokenDTO | null>(null);
  const [editName, setEditName] = useState("");
  const [editScopes, setEditScopes] = useState<Set<string>>(new Set());
  const [editExpiry, setEditExpiry] = useState("");
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const tokens = data?.tokens?.filter((t) => !t.revoked) ?? [];

  const handleStartEdit = (token: ApiTokenDTO) => {
    setEditToken(token);
    setEditName(token.name);
    setEditScopes(scopesToSet(token.scopes));
    setEditExpiry(
      token.expiresAt
        ? new Date(token.expiresAt).toISOString().split("T")[0]
        : "",
    );
  };

  const handleSaveEdit = () => {
    if (!editToken) return;
    updateToken.mutate(
      {
        id: editToken.id,
        input: {
          name: editName,
          scopes: setToScopes(editScopes),
          expiresAt: editExpiry || null,
        },
      },
      { onSuccess: () => setEditToken(null) },
    );
  };

  const handleToggleEditScope = (label: string) => {
    setEditScopes((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleConfirmRevoke = () => {
    if (!revokeId) return;
    revokeToken.mutate(revokeId, {
      onSuccess: () => setRevokeId(null),
    });
  };

  return (
    <div>
      <SettingsSection
        title="API Tokens"
        description="Manage personal access tokens for API authentication."
        divider={false}
      >
        <div className="mb-4">
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Generate New Token
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <CircularProgress size={24} />
          </div>
        ) : tokens.length > 0 ? (
          <div>
            {tokens.map((token, i) => (
              <div key={token.id}>
                {i > 0 && <Divider />}
                <TokenListItem
                  token={token}
                  onEdit={handleStartEdit}
                  onRevoke={setRevokeId}
                />
              </div>
            ))}
          </div>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No API tokens yet. Generate one to get started.
          </Typography>
        )}
      </SettingsSection>

      <TokenCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Edit dialog */}
      <Dialog
        open={!!editToken}
        onClose={() => setEditToken(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Token</DialogTitle>
        <DialogContent>
          {updateToken.error && (
            <Alert severity="error" className="mb-4">
              {updateToken.error.message}
            </Alert>
          )}
          <div className="space-y-4 pt-2">
            <TextField
              fullWidth
              label="Token Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              variant="standard"
              required
            />
            <div>
              <Typography variant="body2" className="font-medium mb-2">
                Scopes
              </Typography>
              {AVAILABLE_SCOPES.map((s) => (
                <FormControlLabel
                  key={s.label}
                  control={
                    <Checkbox
                      size="small"
                      checked={editScopes.has(s.label)}
                      onChange={() => handleToggleEditScope(s.label)}
                    />
                  }
                  label={<Typography variant="body2">{s.label}</Typography>}
                />
              ))}
            </div>
            <TextField
              fullWidth
              label="Expiration Date"
              type="date"
              value={editExpiry}
              onChange={(e) => setEditExpiry(e.target.value)}
              variant="standard"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditToken(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={!editName || updateToken.isPending}
          >
            {updateToken.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={!!revokeId} onClose={() => setRevokeId(null)}>
        <DialogTitle>Revoke Token</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to revoke this token? Any applications using
            it will lose access immediately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmRevoke}
            disabled={revokeToken.isPending}
          >
            {revokeToken.isPending ? "Revoking..." : "Revoke"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
