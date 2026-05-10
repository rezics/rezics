import { queryAccessToken } from "@rezics/api/react-query/jwt";
import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
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

type SessionStatus = "active" | "missing";

function StatusBadge({ status }: { status: SessionStatus }) {
  const map = {
    active: { label: "Active", className: "bg-success-fill text-white" },
    missing: { label: "No Main Session", className: "" },
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

function SessionRefreshCard({
  title,
  onRefresh,
  refreshLabel,
}: {
  title: string;
  onRefresh: () => Promise<void>;
  refreshLabel: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const permission = useAuthSessionStore((s) => s.rezics.permission);
  const status: SessionStatus = permission ? "active" : "missing";

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
        <p className="text-sm text-text-secondary">
          Browser session credentials are httpOnly cookies. This view refreshes
          the main session and re-hydrates server state without reading JWT
          claims from localStorage.
        </p>
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
  const hasAuthIdentity = useAuthSessionStore((s) => s.auth.hasIdentity);
  const hasMemberSession = useAuthSessionStore(
    (s) => s.rezics.hasMemberSession,
  );
  const registrationStage = useAuthSessionStore((s) => s.registration.stage);
  const permission = useAuthSessionStore((s) => s.rezics.permission);
  const mainUserExists = useAuthSessionStore((s) => s.rezics.mainUserExists);
  const needsMainSetup = useAuthSessionStore(
    (s) => s.registration.needsMainSetup,
  );
  const registrationComplete = useAuthSessionStore(
    (s) => s.registration.complete,
  );
  const user = useAuthSessionStore((s) => s.auth.user);
  const session = useAuthSessionStore((s) => s.auth.session);
  const error = useAuthSessionStore((s) => s.error);

  const rows: [string, React.ReactNode][] = [
    ["Hydration Status", status],
    ["Auth Identity", hasAuthIdentity ? "Yes" : "No"],
    ["Member Session", hasMemberSession ? "Yes" : "No"],
    ["Registration Stage", registrationStage],
    [
      "Server Permission",
      <Badge key="perm" variant="secondary">
        {permission?.role ?? "none"}
      </Badge>,
    ],
    ["Main User Exists", mainUserExists ? "Yes" : "No"],
    ["Needs Main Setup", needsMainSetup ? "Yes" : "No"],
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
      description="View cookie-backed session status across services"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <SessionRefreshCard
            title="Cookie Session"
            onRefresh={async () => {
              await queryAccessToken({ requirePresence: false });
              await hydrateAuthSessionState({ requirePresence: false });
            }}
            refreshLabel="Refresh Session"
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
