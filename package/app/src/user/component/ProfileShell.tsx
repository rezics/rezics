import { Box, CircularProgress, Typography } from "@mui/material";
import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import {
  Outlet,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type FC } from "react";
import { useUserProfileStore } from "@/user/state";
import { ProfileHeaderCompact } from "./ProfileHeaderCompact";
import { ProfileHeaderDefault } from "./ProfileHeaderDefault";
import { ProfileHeaderFull } from "./ProfileHeaderFull";
import { ProfileTabBar } from "./ProfileTabBar";

interface ProfileContextValue {
  user: UserDTO;
  isCurrentUser: boolean;
  unitId: string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfileContext must be used within ProfileShell");
  return ctx;
}

export const ProfileShell: FC = () => {
  const { unitId } = useParams({ strict: false }) as { unitId: string };
  const currentUser = useUserProfileStore((s) => s.user);
  const isCurrentUser = currentUser?.unitId === unitId;

  const meQuery = useQuery({
    ...userQueries.me(),
    enabled: isCurrentUser,
  });
  const detailQuery = useQuery({
    ...userQueries.detail(unitId),
    enabled: !isCurrentUser && !!unitId,
  });

  const user = (isCurrentUser ? meQuery.data : detailQuery.data) as
    | UserDTO
    | undefined;
  const isLoading = meQuery.isLoading || detailQuery.isLoading;
  const error = meQuery.error ?? detailQuery.error;

  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const basePath = `/user/${unitId}`;
  const isOverviewTab =
    pathname === basePath || pathname === `${basePath}/`;

  if (isLoading) {
    return (
      <Box className="flex items-center justify-center h-64">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Box className="flex items-center justify-center h-64">
        <Typography color="error">
          {error ? (error as Error).message : "User not found"}
        </Typography>
      </Box>
    );
  }

  return (
    <ProfileContext.Provider value={{ user, isCurrentUser, unitId }}>
      <Box className="w-full max-w-5xl mx-auto">
        {/* L1 Tab Bar — always at the top */}
        <ProfileTabBar unitId={unitId} />

        {/* User info — responsive variants */}
        <div className="hidden md:block">
          <ProfileHeaderDefault user={user} isCurrentUser={isCurrentUser} />
        </div>
        <div className="md:hidden">
          {isOverviewTab ? (
            <ProfileHeaderFull user={user} isCurrentUser={isCurrentUser} />
          ) : (
            <ProfileHeaderCompact user={user} unitId={unitId} />
          )}
        </div>

        {/* Tab content */}
        <Box className="px-4 pb-8">
          <Outlet />
        </Box>
      </Box>
    </ProfileContext.Provider>
  );
};
