// Shared route-level boundary states.
//
// Feature routes should not redefine loading / error / not-found / denied /
// unauthenticated chrome. Use `routeBoundaries()` to spread the common
// `pendingComponent` / `errorComponent` / `notFoundComponent` into a route, and
// render `RouteDenied` / `RouteUnauthenticated` from a route component when a
// policy or session check fails.

import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardFooter,
} from "@rezics/ui/shadcn";
import {
  type ErrorComponentProps,
  useCanGoBack,
  useRouter,
} from "@tanstack/react-router";
import {
  TriangleAlert as AlertTriangle,
  LoaderCircle,
  LogIn,
  ShieldAlert,
} from "lucide-react";
import type React from "react";
import type { ReactNode } from "react";
import { NotFoundContainer } from "@/core/pages/NotFound";
import { TextLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

interface BoundaryShellProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}

function BoundaryShell({
  icon,
  title,
  description,
  actions,
}: BoundaryShellProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card surface="contained" className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <div className="text-text-tertiary" aria-hidden="true">
            {icon}
          </div>
          <h2 className="m-0 text-2xl font-medium leading-ui text-text-primary">
            {title}
          </h2>
          {description ? (
            <p className="m-0 text-sm leading-body text-text-secondary">
              {description}
            </p>
          ) : null}
        </CardContent>
        {actions ? (
          <CardFooter className="flex flex-row justify-center gap-2">
            {actions}
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}

/** Pending state for a route whose loader/component is in flight. */
export const RouteLoading: React.FC = () => {
  const { t } = useTranslation(["common"]);
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-text-tertiary"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle
        className="h-6 w-6 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="text-sm leading-ui">{t("common:loading")}</span>
    </div>
  );
};

/** Error boundary state. Receives router error props when used as a route `errorComponent`. */
export const RouteError: React.FC<Partial<ErrorComponentProps>> = ({
  reset,
}) => {
  const { t } = useTranslation(["common"]);
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const handleRetry = () => {
    reset?.();
    void router.invalidate();
  };

  return (
    <BoundaryShell
      icon={<AlertTriangle className="h-10 w-10 text-warning-text" />}
      title={t("common:route_error_title")}
      description={t("common:route_error_description")}
      actions={
        <>
          {canGoBack ? (
            <Button variant="ghost" onClick={() => router.history.back()}>
              {t("common:back")}
            </Button>
          ) : null}
          <Button variant="default" onClick={handleRetry}>
            {t("common:retry")}
          </Button>
        </>
      }
    />
  );
};

/** Denied state for a route the signed-in user lacks permission to view. */
export const RouteDenied: React.FC<{
  title?: string;
  description?: string;
}> = ({ title, description }) => {
  const { t } = useTranslation(["common"]);
  return (
    <BoundaryShell
      icon={<ShieldAlert className="h-10 w-10 text-warning-text" />}
      title={title ?? t("common:route_denied_title")}
      description={description ?? t("common:route_denied_description")}
    />
  );
};

/** Unauthenticated state prompting the visitor to sign in. */
export const RouteUnauthenticated: React.FC<{
  title?: string;
  description?: string;
}> = ({ title, description }) => {
  const { t } = useTranslation(["common"]);
  return (
    <BoundaryShell
      icon={<LogIn className="h-10 w-10" />}
      title={title ?? t("common:route_unauthenticated_title")}
      description={description ?? t("common:route_unauthenticated_description")}
      actions={
        <TextLink
          to="/login"
          className={cn(buttonVariants({ variant: "default" }), "no-underline")}
        >
          {t("common:sign_in")}
        </TextLink>
      }
    />
  );
};

/** Not-found state. Re-exported so routes share a single source. */
export const RouteNotFound = NotFoundContainer;

/**
 * Common route boundary components to spread into a `createFileRoute(...)`
 * definition so feature routes don't redefine them:
 *
 * ```ts
 * createFileRoute("/_mainLayout/x")({ component: X, ...routeBoundaries() });
 * ```
 */
export function routeBoundaries() {
  return {
    pendingComponent: RouteLoading,
    errorComponent: RouteError,
    notFoundComponent: RouteNotFound,
  };
}
