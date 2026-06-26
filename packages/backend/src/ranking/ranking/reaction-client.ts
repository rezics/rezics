export type ReactionSummaryMap = Record<string, Record<string, number>>;

export type ReactionSummaryReader = {
  getSummary(
    targetIds: string[],
    contextUnitId?: string | null,
  ): Promise<ReactionSummaryMap>;
};

export type ReactionSummaryClientOptions = {
  service?: ReactionSummaryReader;
};

async function getReactionService(): Promise<ReactionSummaryReader> {
  const { reactionService } = await import(
    "../../reaction/reaction/reaction.service"
  );
  return reactionService;
}

export class ReactionSummaryClient {
  constructor(private readonly options: ReactionSummaryClientOptions = {}) {}

  async getSummaries(
    targetIds: string[],
    options: { contextUnitId?: string | null } = {},
  ): Promise<ReactionSummaryMap> {
    if (targetIds.length === 0) return {};
    const service = this.options.service ?? (await getReactionService());
    return service.getSummary(targetIds, options.contextUnitId);
  }
}
