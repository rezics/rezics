import { createContext, useContext } from "react";
import type { EngagementSize, ReactionBarVariant } from "../types";

export type ReactionBarContextValue = {
  variant: ReactionBarVariant;
  size: EngagementSize;
};

const ReactionBarContext = createContext<ReactionBarContextValue>({
  variant: "plain",
  size: "md",
});

export const ReactionBarProvider = ReactionBarContext.Provider;

export function useReactionBarContext(): ReactionBarContextValue {
  return useContext(ReactionBarContext);
}
