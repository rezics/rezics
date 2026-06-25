import type { RankingCommand } from "@rezics/contract/job";

export type RankingRuntimeOptions = {
  rankingBaseUrl?: string;
  rankingInternalSecret?: string;
};

export type RankingRuntime = {
  dispatch(command: RankingCommand): Promise<unknown>;
  disconnect(): Promise<void>;
};

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function createRankingRuntime(
  options: RankingRuntimeOptions,
): RankingRuntime {
  return {
    async dispatch(command) {
      if (!options.rankingBaseUrl) {
        throw new Error(
          "RANKING_BASE_URL is required to process ranking commands",
        );
      }

      const response = await fetch(
        joinUrl(options.rankingBaseUrl, "/ranking/command"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(options.rankingInternalSecret
              ? { "x-internal-secret": options.rankingInternalSecret }
              : {}),
          },
          body: JSON.stringify(command),
        },
      );

      if (!response.ok) {
        throw new Error(
          `ranking command dispatch failed: ${response.status} ${await response.text()}`,
        );
      }

      return response.json();
    },
    async disconnect() {},
  };
}
