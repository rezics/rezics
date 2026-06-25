import {
  useMuteRealmMutation,
  useUnmuteRealmMutation,
} from "@rezics/contract/api/realm/realm";
import { useIsSubscribed } from "@rezics/contract/api/subscription/subscription.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { selectHasMemberSession, useAuthSessionStore } from "@/user";

interface RealmMuteButtonProps {
  realmUnitId: string;
}

/**
 * Realm header affordance for muting / unmuting activity notifications.
 *
 * Mute removes the Subscription edge while keeping the RealmMember row
 * intact, preserving posting rights and role. The toggle reflects the
 * live subscription state from
 * `useIsSubscribed`, falling back to "Mute" when no membership exists
 * (a logged-out or non-member surface — the button is disabled).
 */
export const RealmMuteButton: React.FC<RealmMuteButtonProps> = ({
  realmUnitId,
}) => {
  const { t } = useTranslation("entity");
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const { data: subscription, isLoading } = useIsSubscribed(
    hasMemberSession ? realmUnitId : "",
  );
  const muteMutation = useMuteRealmMutation();
  const unmuteMutation = useUnmuteRealmMutation();

  if (!hasMemberSession) return null;

  const isSubscribed = subscription?.subscribed ?? false;
  const pending =
    isLoading || muteMutation.isPending || unmuteMutation.isPending;

  const handleClick = () => {
    if (pending) return;
    if (isSubscribed) {
      muteMutation.mutate(realmUnitId);
    } else {
      unmuteMutation.mutate(realmUnitId);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      title={isSubscribed ? t("realm_mute_tooltip") : t("realm_unmute_tooltip")}
    >
      {isSubscribed ? t("realm_mute") : t("realm_unmute")}
    </Button>
  );
};
