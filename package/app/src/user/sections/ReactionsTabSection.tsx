import {
  useGivenReactionsInfinite,
  useReceivedReactionsInfinite,
} from "@rezics/api/reaction/reaction.queries";
import type { FC } from "react";
import { useState } from "react";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";
import { useProfileContext } from "@/user/components/ProfileLayout";
import { ReactionList } from "@/user/components/ReactionList";
import {
  profile_reactions_given,
  profile_reactions_received,
} from "@rezics/i18n/messages";
const i18nMessages = {
  profile_reactions_given,
  profile_reactions_received,
};

type Mode = "given" | "received";

const REACTION_MODE_LABEL = {
  given: i18nMessages.profile_reactions_given,
  received: i18nMessages.profile_reactions_received,
} as const satisfies Record<Mode, () => string>;

export const ReactionsTabSection: FC = () => {
  const { userId } = useProfileContext();
  const [mode, setMode] = useState<Mode>("given");

  const givenQuery = useGivenReactionsInfinite(userId, {
    enabled: mode === "given",
  });
  const receivedQuery = useReceivedReactionsInfinite(userId, {
    enabled: mode === "received",
  });
  const filterChips: ChipDefinition[] = [
    { value: "given", label: REACTION_MODE_LABEL.given() },
    { value: "received", label: REACTION_MODE_LABEL.received() },
  ];

  return (
    <div className="flex flex-col gap-4 py-4">
      <InnerFilterPanel
        chips={filterChips}
        activeValue={mode}
        onChipChange={(value) => setMode(value as Mode)}
      />

      {mode === "given" ? (
        <ReactionList
          mode="given"
          items={givenQuery.data?.pages.flatMap((p) => p.items) ?? []}
          isLoading={givenQuery.isLoading}
          isFetchingNextPage={givenQuery.isFetchingNextPage}
          hasNextPage={Boolean(givenQuery.hasNextPage)}
          fetchNextPage={() => givenQuery.fetchNextPage()}
          error={(givenQuery.error as Error | null) ?? null}
          refetch={() => givenQuery.refetch()}
        />
      ) : (
        <ReactionList
          mode="received"
          items={receivedQuery.data?.pages.flatMap((p) => p.items) ?? []}
          isLoading={receivedQuery.isLoading}
          isFetchingNextPage={receivedQuery.isFetchingNextPage}
          hasNextPage={Boolean(receivedQuery.hasNextPage)}
          fetchNextPage={() => receivedQuery.fetchNextPage()}
          error={(receivedQuery.error as Error | null) ?? null}
          refetch={() => receivedQuery.refetch()}
        />
      )}
    </div>
  );
};
