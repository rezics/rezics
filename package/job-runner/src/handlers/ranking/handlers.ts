import {
  type AnyJobCommand,
  type RankingCommand,
  RANKING_COMMAND_KINDS,
} from "@rezics/job";

export type RankingCommandDispatcher = {
  dispatch(command: RankingCommand): Promise<unknown>;
};

function isRankingCommand(command: AnyJobCommand): command is RankingCommand {
  return command.kind.startsWith("ranking.");
}

function createDispatchHandler(dispatcher: RankingCommandDispatcher) {
  return async (command: AnyJobCommand) => {
    if (!isRankingCommand(command)) throw new Error("Expected ranking command");
    return dispatcher.dispatch(command);
  };
}

export function createRankingHandlers(dispatcher: RankingCommandDispatcher) {
  const dispatch = createDispatchHandler(dispatcher);

  return {
    [RANKING_COMMAND_KINDS.invalidate]: dispatch,
    [RANKING_COMMAND_KINDS.recompute]: dispatch,
    [RANKING_COMMAND_KINDS.patchServing]: dispatch,
    [RANKING_COMMAND_KINDS.fullSync]: dispatch,
    [RANKING_COMMAND_KINDS.viewBucketFlush]: dispatch,
  };
}
