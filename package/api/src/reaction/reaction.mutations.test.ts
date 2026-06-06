import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { reactionKeys } from "./reaction.keys";
import { syncShareMutationCache } from "./reaction.mutations";
import type {
  ReactionSummaryResponse,
  ShareSummaryResponse,
} from "./reaction.types";

describe("share mutation cache sync", () => {
  test("reconciles share summary batches without changing reaction summaries", async () => {
    const queryClient = new QueryClient();
    const shareKey = reactionKeys.shareSummaryBatch(["unit-2", "unit-1"]);
    const reactionKey = reactionKeys.summaryBatch(["unit-1"]);
    const detailKey = ["books", "detail", "unit-1"] as const;

    queryClient.setQueryData<ShareSummaryResponse>(shareKey, {
      summaries: {
        "unit-1": { shareCount: 1 },
        "unit-2": { shareCount: 0 },
      },
    });
    queryClient.setQueryData<ReactionSummaryResponse>(reactionKey, {
      summaries: {
        "unit-1": { like: 2 },
      },
    });
    queryClient.setQueryData(detailKey, { unitId: "unit-1" });

    await syncShareMutationCache({
      queryClient,
      data: { targetId: "unit-1", shareCount: 4, created: false },
    });

    expect(queryClient.getQueryData<ShareSummaryResponse>(shareKey)).toEqual({
      summaries: {
        "unit-1": { shareCount: 4 },
        "unit-2": { shareCount: 0 },
      },
    });
    expect(
      queryClient.getQueryData<ReactionSummaryResponse>(reactionKey),
    ).toEqual({
      summaries: {
        "unit-1": { like: 2 },
      },
    });
    expect(
      queryClient.getQueryCache().find({ queryKey: detailKey })?.state
        .isInvalidated,
    ).toBe(true);
  });
});
