import { getI18nRuntime } from "@rezics/i18n/runtime";

/**
 * ReactionsTabSection — 用户资料页内的互动标签页，支持"给予互动"和"收到互动"两种视图，
 * 使用无限滚动加载，展示用户的所有互动记录。
 *
 * ┌────────────────────────────────────────┐
 * │ Reactions Tab (desktop 1024px+)        │
 * │ ┌──────────────────────────────────────┐
 * │ │ [Reactions Given] [Reactions Rcvd]   │
 * │ ├──────────────────────────────────────┤
 * │ │ ❤ User gave reaction on "Book Title" │
 * │ │ 👍 User gave reaction on "Post Name" │
 * │ │ ⭐ User gave reaction on "Unit"     │
 * │ │                                      │
 * │ │ [Load More]                          │
 * │ └──────────────────────────────────────┘
 * └────────────────────────────────────────┘
 *
 * ┌───────────────────────────┐
 * │ Reactions (tablet 768px)  │
 * │ ┌─────────────────────────┐
 * │ │ [Given] [Received]      │
 * │ ├─────────────────────────┤
 * │ │ ❤ on "Book Title"       │
 * │ │ 👍 on "Post"            │
 * │ │ [Load More]             │
 * │ └─────────────────────────┘
 * └───────────────────────────┘
 *
 * ┌──────────────────────┐
 * │ Reactions (mobile)   │
 * │ ┌────────────────────┐
 * │ │ Given  Received    │
 * │ ├────────────────────┤
 * │ │ ❤ Book..           │
 * │ │ 👍 Post..          │
 * │ │ [Load More]        │
 * │ └────────────────────┘
 * └──────────────────────┘
 *
 * ┌──────────────────────┐
 * │ Empty (no reactions) │
 * │ ┌────────────────────┐
 * │ │ No reactions yet   │
 * │ └────────────────────┘
 * └──────────────────────┘
 */

const i18nMessages = {
  profile_reactions_given: () =>
    getI18nRuntime().i18n.t("settings:profile_reactions_given"),
  profile_reactions_received: () =>
    getI18nRuntime().i18n.t("settings:profile_reactions_received"),
} as const;

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
