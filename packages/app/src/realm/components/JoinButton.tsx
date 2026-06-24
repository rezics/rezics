import {
  myRealmMembershipQuery,
  realmRuleResolvedQuery,
  useAcknowledgeRealmRulesMutation,
  useJoinRealmMutation,
  useLeaveRealmMutation,
} from "@rezics/api/realm/realm";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { RealmRuleDialog } from "../sections/RealmRuleDialog";

interface JoinButtonProps {
  realmId: string;
}

export const JoinButton: React.FC<JoinButtonProps> = ({ realmId }) => {
  const { t } = useTranslation("entity");
  const [ruleOpen, setRuleOpen] = useState(false);
  const readContext = useReadLanguageContext();
  const readQuery = {
    languages: readContext.languages,
    appLocale: readContext.appLocale,
  };
  const { data: myMembership } = useQuery({
    ...myRealmMembershipQuery(realmId),
    enabled: readContext.ready && Boolean(realmId),
  });
  const joinMutation = useJoinRealmMutation();
  const leaveMutation = useLeaveRealmMutation();
  const acknowledgeRules = useAcknowledgeRealmRulesMutation();

  const isMember = myMembership?.member != null;
  const acknowledgementRequired = Boolean(
    myMembership?.ruleAcknowledgement.acknowledgementRequired,
  );
  const { data: rule, isLoading: ruleLoading } = useQuery({
    ...realmRuleResolvedQuery(realmId, undefined, readQuery),
    enabled: readContext.ready && acknowledgementRequired && !isMember,
  });
  const isPending =
    joinMutation.isPending ||
    leaveMutation.isPending ||
    acknowledgeRules.isPending ||
    (acknowledgementRequired && ruleLoading);

  const join = () => {
    joinMutation.mutate(
      { realmUnitId: realmId },
      {
        onSuccess: () => setRuleOpen(false),
      },
    );
  };

  const acknowledgeAndJoin = async () => {
    await acknowledgeRules.mutateAsync({ realmUnitId: realmId, input: {} });
    join();
  };

  const handleToggle = () => {
    if (isMember) {
      leaveMutation.mutate(realmId);
    } else if (acknowledgementRequired) {
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
        {isMember ? t("realm_leave") : t("realm_join")}
      </Button>
      <RealmRuleDialog
        open={ruleOpen}
        rules={rule?.items}
        joining
        joinPending={joinMutation.isPending || acknowledgeRules.isPending}
        onOpenChange={setRuleOpen}
        onAgree={() => void acknowledgeAndJoin()}
      />
    </>
  );
};
