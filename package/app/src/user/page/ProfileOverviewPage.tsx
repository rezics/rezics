import type { FC } from "react";
import { useProfileContext } from "@/user/component/ProfileShell";
import { OverviewMain } from "@/user/component/OverviewMain";
import { OverviewSidebar } from "@/user/component/OverviewSidebar";
import { TwoColumnLayout } from "@/user/component/TwoColumnLayout";

export const ProfileOverviewPage: FC = () => {
  const { user, unitId, isCurrentUser } = useProfileContext();

  return (
    <TwoColumnLayout
      sidebar={
        <OverviewSidebar
          user={user}
          unitId={unitId}
          isCurrentUser={isCurrentUser}
        />
      }
      main={<OverviewMain unitId={unitId} />}
    />
  );
};
