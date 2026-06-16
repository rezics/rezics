import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { hasGovernanceCapabilityHint, useAuthSessionStore } from "@/user";

export function useStaffConsoleAccess() {
  return useAuthSessionStore((state) => ({
    status: state.status,
    allowed:
      state.rezics.permission?.role === "ROOT" ||
      hasGovernanceCapabilityHint(state, "audit.read") ||
      hasGovernanceCapabilityHint(state, "moderation.case.triage") ||
      hasGovernanceCapabilityHint(state, "queue.site.decide"),
  }));
}

export function StaffPageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase leading-ui text-text-tertiary">
            Staff
          </p>
          <h1 className="text-2xl font-semibold leading-ui text-text-primary">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-body text-text-secondary">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      <nav className="flex flex-wrap gap-2 text-sm leading-ui">
        <Link
          to="/staff"
          className="rounded-sm px-3 py-2 text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          activeProps={{
            className:
              "rounded-sm bg-surface-subtle px-3 py-2 font-medium text-text-primary",
          }}
          activeOptions={{ exact: true }}
        >
          Queue
        </Link>
        <Link
          to="/staff/audit"
          className="rounded-sm px-3 py-2 text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          activeProps={{
            className:
              "rounded-sm bg-surface-subtle px-3 py-2 font-medium text-text-primary",
          }}
        >
          Audit
        </Link>
      </nav>
      {children}
    </main>
  );
}

export function StaffForbiddenState() {
  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-3xl flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="h-10 w-10 text-warning-text" aria-hidden />
      <div>
        <h1 className="text-xl font-semibold leading-ui text-text-primary">
          Staff access required
        </h1>
        <p className="mt-2 text-sm leading-body text-text-secondary">
          This area only shows community operations data to staff accounts with
          the matching governance capability.
        </p>
      </div>
    </main>
  );
}

export function StaffLoadingState() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <div className="h-8 w-56 rounded-sm bg-surface-subtle" />
      <div className="h-32 rounded-md bg-surface-subtle" />
      <div className="h-64 rounded-md bg-surface-subtle" />
    </main>
  );
}

export function formatStaffDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}
