import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { createContext, type FC, useContext } from "react";
import { useUserProfileStore } from "@/user/states";
import { ProfileBasicInfo } from "./ProfileBasicInfo";
import { ProfileShell } from "./ProfileShell";

interface ProfileContextValue {
  user: UserDTO;
  isCurrentUser: boolean;
  unitId: string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx)
    throw new Error("useProfileContext must be used within ProfileLayout");
  return ctx;
}

export const ProfileLayout: FC = () => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-rezics-color-danger">
          {error ? (error as Error).message : "User not found"}
        </p>
      </div>
    );
  }

  return (
    <ProfileContext.Provider value={{ user, isCurrentUser, unitId }}>
      <div className="w-full max-w-12/16 mx-auto">
        <div className="flex flex-col md:flex-row md:gap-12 px-4 pb-12">
          <aside className="w-full md:w-[280px] md:shrink-0">
            <ProfileBasicInfo
              user={user}
              isCurrentUser={isCurrentUser}
              unitId={unitId}
            />
          </aside>
          <ProfileShell unitId={unitId} />
        </div>
      </div>
    </ProfileContext.Provider>
  );
};
