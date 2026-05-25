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
import { useMessage } from "@rezics/i18n/react";
import {
  admin_auth_action_hydrate,
  admin_auth_action_hydrate_completed,
  admin_auth_action_logout_completed,
  admin_auth_actions_title,
  admin_auth_cookie_session,
  admin_auth_failed,
  admin_auth_identity,
  admin_auth_main_user_exists,
  admin_auth_member_session,
  admin_auth_missing_session,
  admin_auth_needs_main_setup,
  admin_auth_refresh_session,
  admin_auth_registration_complete,
  admin_auth_registration_stage,
  admin_auth_rehydrate_session_description,
  admin_auth_server_permission,
  admin_auth_session_id,
  admin_auth_session_store,
  admin_auth_status_description,
  admin_auth_status_hydration,
  admin_auth_status_title,
  admin_auth_user_email,
  admin_auth_user_id,
  admin_auth_user_name,
  admin_auth_user_role,
  auth_logout,
  common_active,
  common_no,
  common_none,
  common_yes,
} from "@rezics/i18n/messages";
const i18nMessages = {
  admin_auth_action_hydrate,
  admin_auth_action_hydrate_completed,
  admin_auth_action_logout_completed,
  admin_auth_actions_title,
  admin_auth_cookie_session,
  admin_auth_failed,
  admin_auth_identity,
  admin_auth_main_user_exists,
  admin_auth_member_session,
  admin_auth_missing_session,
  admin_auth_needs_main_setup,
  admin_auth_refresh_session,
  admin_auth_registration_complete,
  admin_auth_registration_stage,
  admin_auth_rehydrate_session_description,
  admin_auth_server_permission,
  admin_auth_session_id,
  admin_auth_session_store,
  admin_auth_status_description,
  admin_auth_status_hydration,
  admin_auth_status_title,
  admin_auth_user_email,
  admin_auth_user_id,
  admin_auth_user_name,
  admin_auth_user_role,
  auth_logout,
  common_active,
  common_no,
  common_none,
  common_yes,
};

type SessionStatus = "active" | "missing";

function StatusBadge({ status }: { status: SessionStatus }) {
  const m = useMessage(i18nMessages);
  const map = {
    active: {
      label: m.common_active(),
      className: "bg-success-fill text-white",
    },
    missing: { label: m.admin_auth_missing_session(), className: "" },
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
  const m = useMessage(i18nMessages);
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
      setError(err instanceof Error ? err.message : m.admin_auth_failed());
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
          {m.admin_auth_rehydrate_session_description()}
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
              {m.admin_auth_action_hydrate_completed()}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function SessionStoreCard() {
  const m = useMessage(i18nMessages);
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
    [m.admin_auth_status_hydration(), status],
    [m.admin_auth_identity(), hasAuthIdentity ? m.common_yes() : m.common_no()],
    [
      m.admin_auth_member_session(),
      hasMemberSession ? m.common_yes() : m.common_no(),
    ],
    [m.admin_auth_registration_stage(), registrationStage],
    [
      m.admin_auth_server_permission(),
      <Badge key="perm" variant="secondary">
        {permission?.role ?? m.common_none()}
      </Badge>,
    ],
    [
      m.admin_auth_main_user_exists(),
      mainUserExists ? m.common_yes() : m.common_no(),
    ],
    [
      m.admin_auth_needs_main_setup(),
      needsMainSetup ? m.common_yes() : m.common_no(),
    ],
    [
      m.admin_auth_registration_complete(),
      registrationComplete ? m.common_yes() : m.common_no(),
    ],
    [m.admin_auth_user_id(), user?.id ?? "-"],
    [m.admin_auth_user_name(), user?.name ?? "-"],
    [m.admin_auth_user_email(), user?.email ?? "-"],
    [m.admin_auth_user_role(), user?.role ?? "-"],
    [m.admin_auth_session_id(), session?.id ?? "-"],
  ];

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <ShieldUser className="size-4" />
          <h3 className="text-base font-bold">
            {m.admin_auth_session_store()}
          </h3>
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
  const m = useMessage(i18nMessages);
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
      setFeedback({
        type: "success",
        message:
          key === "Hydrate"
            ? m.admin_auth_action_hydrate_completed()
            : m.admin_auth_action_logout_completed(),
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : m.admin_auth_failed(),
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardContent>
        <h3 className="text-base font-bold mb-4">
          {m.admin_auth_actions_title()}
        </h3>
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
            {m.admin_auth_action_hydrate()}
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
            {m.auth_logout()}
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
  const m = useMessage(i18nMessages);
  return (
    <Page
      title={m.admin_auth_status_title()}
      description={m.admin_auth_status_description()}
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <SessionRefreshCard
            title={m.admin_auth_cookie_session()}
            onRefresh={async () => {
              await queryAccessToken({ requirePresence: false });
              await hydrateAuthSessionState({ requirePresence: false });
            }}
            refreshLabel={m.admin_auth_refresh_session()}
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
