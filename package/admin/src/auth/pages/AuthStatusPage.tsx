import {
  getToken,
  parseJwt,
  queryAccessToken,
} from "@rezics/api/react-query/jwt";
import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
import { NormalizedTokenName } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@rezics/ui/shadcn";
import { Shield, ShieldUser } from "lucide-react";
import { useState } from "react";

import { Page } from "@/core/layouts/Page";
import { adminLogout } from "@/user/models/handler";

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

function StatusBadge({ status }: { status: TokenStatus }) {
  const map = {
    active: { label: "Active", className: "bg-success-fill text-white" },
    expired: { label: "Expired", className: "bg-error-fill text-white" },
    missing: { label: "Not Present", className: "" },
  } as const;
  const { label, className } = map[status];
  return (
    <Badge
      variant={status === "missing" ? "secondary" : "default"}
      className={className}
    >
      {label}
    </Badge>
  );
}

function ClaimsTable({ tokenName }: { tokenName: NormalizedTokenName }) {
  const token = getToken(tokenName);
  if (!token) return <p className="text-sm text-text-secondary">No token</p>;

  const claims = parseJwt(token);
  if (!claims)
    return <p className="text-sm text-text-secondary">Invalid token</p>;

  const entries = Object.entries(claims).filter(
    ([k]) => !["iat", "nbf"].includes(k),
  );

  return (
    <Table className="text-sm">
      <TableBody>
        {entries.map(([key, value]) => (
          <TableRow key={key}>
            <TableCell className="py-1.5 font-semibold w-36">{key}</TableCell>
            <TableCell className="py-1.5 font-mono text-[13px]">
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
    <Card>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="size-4" />
          <h3 className="text-base font-bold">{title}</h3>
          <StatusBadge status={status} />
        </div>
        <ClaimsTable tokenName={tokenName} />
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : null}
            {refreshLabel}
          </Button>
        </div>
        {error && (
          <Alert className="mt-2">
            <AlertDescription className="text-error-text">
              {error}
            </AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mt-2">
            <AlertDescription className="text-success-text">
              Done
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function SessionStoreCard() {
  const status = useAuthSessionStore((s) => s.status);
  const permission = useAuthSessionStore((s) => s.permission);
  const identitySet = useAuthSessionStore((s) => s.identitySet);
  const registrationComplete = useAuthSessionStore(
    (s) => s.registrationComplete,
  );
  const user = useAuthSessionStore((s) => s.user);
  const session = useAuthSessionStore((s) => s.session);
  const error = useAuthSessionStore((s) => s.error);

  const rows: [string, React.ReactNode][] = [
    ["Hydration Status", status],
    ["Authenticated", permission ? "Yes" : "No"],
    [
      "Server Permission",
      <Badge key="perm" variant="secondary">
        {permission?.role ?? "none"}
      </Badge>,
    ],
    ["Identity Set", identitySet ? "Yes" : "No"],
    ["Registration Complete", registrationComplete ? "Yes" : "No"],
    ["User ID", user?.id ?? "-"],
    ["User Name", user?.name ?? "-"],
    ["User Email", user?.email ?? "-"],
    ["User Role", user?.role ?? "-"],
    ["Session ID", session?.id ?? "-"],
  ];

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <ShieldUser className="size-4" />
          <h3 className="text-base font-bold">Auth Session Store</h3>
        </div>
        <Table className="text-sm">
          <TableBody>
            {rows.map(([label, value]) => (
              <TableRow key={label}>
                <TableCell className="py-1.5 font-semibold w-44">
                  {label}
                </TableCell>
                <TableCell className="py-1.5">{value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {error && (
          <Alert className="mt-4">
            <AlertDescription className="text-error-text">
              {error}
            </AlertDescription>
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
    <Card>
      <CardContent>
        <h3 className="text-base font-bold mb-4">Actions</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading !== null}
            onClick={() =>
              run("Hydrate", () => hydrateAuthSessionState().then(() => {}))
            }
          >
            {loading === "Hydrate" ? <Spinner size="sm" /> : null}
            Re-hydrate Session
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            disabled={loading !== null}
            onClick={() => run("Logout", adminLogout)}
            className="text-error-text"
          >
            {loading === "Logout" ? <Spinner size="sm" /> : null}
            Logout
          </Button>
        </div>
        {feedback && (
          <Alert className="mt-4">
            <AlertDescription
              className={
                feedback.type === "success"
                  ? "text-success-text"
                  : "text-error-text"
              }
            >
              {feedback.message}
            </AlertDescription>
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
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <TokenCard
            title="AUTH_SESSION"
            tokenName={NormalizedTokenName.AUTH_SESSION}
            onRefresh={async () => {
              await queryAccessToken({ requirePresence: false });
            }}
            refreshLabel="Refresh Token"
          />
        </div>
        <div className="col-span-12 md:col-span-6">
          <SessionStoreCard />
        </div>
        <div className="col-span-12 md:col-span-6">
          <ActionsCard />
        </div>
      </div>
    </Page>
  );
}
