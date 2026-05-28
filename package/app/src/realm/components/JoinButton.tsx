import {
  myRealmsQuery,
  realmDetailQuery,
  realmRuleResolvedQuery,
  useJoinRealmMutation,
  useLeaveRealmMutation,
} from "@rezics/api/realm/realm";
import { mainMarkdownSource } from "@rezics/contract";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { RealmRuleDialog } from "../sections/RealmRuleDialog";

interface JoinButtonProps {
  realmId: string;
}

export const JoinButton: React.FC<JoinButtonProps> = ({ realmId }) => {
  const [ruleOpen, setRuleOpen] = useState(false);
  const { data: myRealms } = useQuery(myRealmsQuery());
  const { data: realm } = useQuery(realmDetailQuery(realmId));
  const joinMutation = useJoinRealmMutation();
  const leaveMutation = useLeaveRealmMutation();

  const isMember = myRealms?.realms?.some((r) => r.unitId === realmId) ?? false;
  const rulePostId = realm?.extra?.rule ?? undefined;
  const {
    data: rule,
    isLoading: ruleLoading,
    isError: ruleError,
  } = useQuery({
    ...realmRuleResolvedQuery(realmId),
    enabled: Boolean(rulePostId) && !isMember,
  });
  const ruleContent =
    rule?.sourceRulePost?.content ?? rule?.translation?.description ?? null;
  const isPending =
    joinMutation.isPending ||
    leaveMutation.isPending ||
    (Boolean(rulePostId) && ruleLoading);

  useEffect(() => {
    if (ruleOpen && ruleContent && !mainMarkdownSource(ruleContent)?.trim()) {
      console.error("Join rule modal opened with empty post content.");
    }
  }, [ruleContent, ruleOpen]);

  const join = () => {
    joinMutation.mutate(
      { realmUnitId: realmId },
      {
        onSuccess: () => setRuleOpen(false),
      },
    );
  };

  const handleToggle = () => {
    if (isMember) {
      leaveMutation.mutate(realmId);
    } else if (rulePostId && ruleContent && !ruleError) {
      setRuleOpen(true);
    } else {
      join();
    }
  };

  return (
    <>
      <Button
        variant={isMember ? "outline" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={isPending}
      >
        {isMember ? "Leave" : "Join"}
      </Button>
      <RealmRuleDialog
        open={ruleOpen}
        content={ruleContent}
        joining
        joinPending={joinMutation.isPending}
        onOpenChange={setRuleOpen}
        onAgree={join}
      />
    </>
  );
};
