import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import {
  getToken,
  parseJwt,
  queryAccessToken,
} from "@rezics/api/react-query/jwt";
import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/app-shell";
import { NormalizedTokenName } from "@rezics/contract";
import { useState } from "react";

import { Page } from "@/core/layout/Page";
import { adminLogout } from "@/user/model/handler";

function formatExpiry(exp?: number) {
  if (!exp) return "N/A";
  const date = new Date(exp * 1000);
  const now = Date.now();
  const diff = exp * 1000 - now;
  const mins = Math.round(diff / 60_000);

  if (diff <= 0) return `Expired (${date.toLocaleString()})`;
  if (mins < 60) return `${date.toLocaleString()} (${mins}m remaining)`;
  const hours = Math.round(mins / 60);
  return `${date.toLocaleString()} (${hours}h remaining)`;
}

type TokenStatus = "active" | "expired" | "missing";

function getTokenStatus(tokenName: NormalizedTokenName): TokenStatus {
  const token = getToken(tokenName);
  if (!token) return "missing";
  const claims = parseJwt(token);
  if (!claims?.exp) return "active";
  return claims.exp * 1000 > Date.now() ? "active" : "expired";
}

function StatusChip({ status }: { status: TokenStatus }) {
  const map = {
    active: { label: "Active", color: "success" as const },
    expired: { label: "Expired", color: "error" as const },
    missing: { label: "Not Present", color: "default" as const },
  };
  const { label, color } = map[status];
  return <Chip label={label} color={color} size="small" />;
}

function ClaimsTable({ tokenName }: { tokenName: NormalizedTokenName }) {
  const token = getToken(tokenName);
  if (!token) return <Typography color="text.secondary">No token</Typography>;

  const claims = parseJwt(token);
  if (!claims)
    return <Typography color="text.secondary">Invalid token</Typography>;

  const entries = Object.entries(claims).filter(
    ([k]) => !["iat", "nbf"].includes(k),
  );

  return (
    <Table size="small">
      <TableBody>
        {entries.map(([key, value]) => (
          <TableRow key={key}>
            <TableCell sx={{ fontWeight: 600, width: 140 }}>{key}</TableCell>
            <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
              {key === "exp" ? formatExpiry(value as number) : String(value)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TokenCard({
  title,
  tokenName,
  onRefresh,
  refreshLabel,
}: {
  title: string;
  tokenName: NormalizedTokenName;
  onRefresh: () => Promise<void>;
  refreshLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const status = getTokenStatus(tokenName);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await onRefresh();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
          <StatusChip status={status} />
        </Box>
        <ClaimsTable tokenName={tokenName} />
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleRefresh}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {refreshLabel}
          </Button>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Done
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function SessionStoreCard() {
  const status = useAuthSessionStore((s) => s.status);
  const hasAuthSession = useAuthSessionStore((s) => s.hasAuthSession);
  const capabilityLevel = useAuthSessionStore((s) => s.capabilityLevel);
  const needsVerification = useAuthSessionStore((s) => s.needsVerification);
  const needsOnboarding = useAuthSessionStore((s) => s.needsOnboarding);
  const user = useAuthSessionStore((s) => s.user);
  const session = useAuthSessionStore((s) => s.session);
  const error = useAuthSessionStore((s) => s.error);

  const rows: [string, React.ReactNode][] = [
    ["Hydration Status", status],
    ["Has Auth Session", hasAuthSession ? "Yes" : "No"],
    [
      "Capability Level",
      <Chip key="cap" label={capabilityLevel} size="small" />,
    ],
    ["Needs Verification", needsVerification ? "Yes" : "No"],
    ["Needs Onboarding", needsOnboarding ? "Yes" : "No"],
    ["User ID", user?.id ?? "-"],
    ["User Name", user?.name ?? "-"],
    ["User Email", user?.email ?? "-"],
    ["User Role", user?.role ?? "-"],
    ["Session ID", session?.id ?? "-"],
  ];

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Auth Session Store
        </Typography>
        <Table size="small">
          <TableBody>
            {rows.map(([label, value]) => (
              <TableRow key={label}>
                <TableCell sx={{ fontWeight: 600, width: 180 }}>
                  {label}
                </TableCell>
                <TableCell>{value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ActionsCard() {
  const [loading, setLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setLoading(key);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ type: "success", message: `${key} completed` });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Actions
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            disabled={loading !== null}
            onClick={() =>
              run("Hydrate", () => hydrateAuthSessionState().then(() => {}))
            }
          >
            {loading === "Hydrate" ? (
              <CircularProgress size={16} sx={{ mr: 1 }} />
            ) : null}
            Re-hydrate Session
          </Button>
          <Divider orientation="vertical" flexItem />
          <Button
            variant="outlined"
            size="small"
            color="error"
            disabled={loading !== null}
            onClick={() => run("Logout", adminLogout)}
          >
            {loading === "Logout" ? (
              <CircularProgress size={16} sx={{ mr: 1 }} />
            ) : null}
            Logout
          </Button>
        </Box>
        {feedback && (
          <Alert severity={feedback.type} sx={{ mt: 2 }}>
            {feedback.message}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default function AuthStatusPage() {
  return (
    <Page
      title="Auth Status"
      description="View login status across services and manage tokens"
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TokenCard
            title="AUTH_IDENTITY"
            tokenName={NormalizedTokenName.AUTH_IDENTITY}
            onRefresh={async () => {
              await queryAccessToken({ requirePresence: false });
            }}
            refreshLabel="Refresh Token"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SessionStoreCard />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ActionsCard />
        </Grid>
      </Grid>
    </Page>
  );
}
