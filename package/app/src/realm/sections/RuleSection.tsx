import type React from "react";
import { RealmRuleSummaryCard } from "./RealmRuleSummaryCard";

export interface RuleSectionProps {
  realmUnitId: string;
  postUnitId?: string | null;
  empty?: "hidden" | "state";
}

export const RuleSection: React.FC<RuleSectionProps> = ({
  realmUnitId,
  postUnitId,
  empty,
}) => (
  <RealmRuleSummaryCard
    realmUnitId={realmUnitId}
    fallbackPostUnitId={postUnitId}
    empty={empty}
  />
);
