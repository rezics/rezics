export type ReactionSummaryMap = Record<string, Record<string, number>>;

export type ReactionSummaryClientOptions = {
  baseUrl: string;
  internalSecret: string;
};

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export class ReactionSummaryClient {
  constructor(private readonly options: ReactionSummaryClientOptions) {}

  async getSummaries(
    targetIds: string[],
    options: { scopeKey?: string | null } = {},
  ): Promise<ReactionSummaryMap> {
    if (targetIds.length === 0) return {};
    const params = new URLSearchParams();
    for (const id of targetIds) params.append("targetIds", id);
    if (options.scopeKey) params.set("scopeKey", options.scopeKey);

    const response = await fetch(
      joinUrl(this.options.baseUrl, `/reaction/summary?${params.toString()}`),
      {
        headers: {
          "x-internal-secret": this.options.internalSecret,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `reaction summary fetch failed: ${response.status} ${await response.text()}`,
      );
    }

    const body = (await response.json()) as { summaries?: ReactionSummaryMap };
    return body.summaries ?? {};
  }
}
