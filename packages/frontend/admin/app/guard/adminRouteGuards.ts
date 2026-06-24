import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/contract/api/states";
import { redirect } from "@tanstack/react-router";
import {
  buildCurrentRedirectPath,
  isAdminRole,
  isOwnerRole,
} from "./adminAuthGuardUtils";

type RouteLocation = Parameters<typeof buildCurrentRedirectPath>[0];

async function getHydratedAuthState() {
  if (useAuthSessionStore.getState().status === "idle") {
    await hydrateAuthSessionState({ requirePresence: false });
  }

  return useAuthSessionStore.getState();
}

export async function requireAdminRouteAccess(location: RouteLocation) {
  const { auth, rezics } = await getHydratedAuthState();

  if (rezics.permission && isAdminRole(auth.role)) return;

  throw redirect({
    to: "/login",
    search: { redirect: buildCurrentRedirectPath(location) },
    replace: true,
  });
}

export async function requireOwnerRouteAccess() {
  const { auth, rezics } = await getHydratedAuthState();

  if (rezics.permission && isOwnerRole(auth.role)) return;

  throw redirect({ to: "/", replace: true });
}
