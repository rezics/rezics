import Button from "@mui/material/Button";
import {
  myRealmsQuery,
  useJoinRealmMutation,
  useLeaveRealmMutation,
} from "@rezics/api/realm/realm";
import { useQuery } from "@tanstack/react-query";
import type React from "react";

interface JoinButtonProps {
  realmId: string;
}

export const JoinButton: React.FC<JoinButtonProps> = ({ realmId }) => {
  const { data: myRealms } = useQuery(myRealmsQuery());
  const joinMutation = useJoinRealmMutation();
  const leaveMutation = useLeaveRealmMutation();

  const isMember = myRealms?.realms?.some((r) => r.unitId === realmId) ?? false;
  const isPending = joinMutation.isPending || leaveMutation.isPending;

  const handleToggle = () => {
    if (isMember) {
      leaveMutation.mutate(realmId);
    } else {
      joinMutation.mutate({ realmUnitId: realmId });
    }
  };

  return (
    <Button
      variant={isMember ? "outlined" : "contained"}
      disableElevation
      size="small"
      onClick={handleToggle}
      disabled={isPending}
    >
      {isMember ? "Leave" : "Join"}
    </Button>
  );
};
