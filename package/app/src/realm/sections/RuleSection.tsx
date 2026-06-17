import type React from "react";
import { RealmRuleSummaryCard } from "./RealmRuleSummaryCard";

/**
 * Wrapper section displaying realm rules via RealmRuleSummaryCard.
 * Simple pass-through component for rule content display (loaded from post).
 *
 * 通过RealmRuleSummaryCard显示社区规则的包装器部分。
 * 用于规则内容显示的简单通道组件(从帖子加载)。
 *
 * Layout (delegates to RealmRuleSummaryCard):
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Rules / Guidelines       │
 * ├──────────────────────────┤
 * │ Rule content rendered    │
 * │ as markdown, clamped     │
 * │ to max lines             │
 * │ [Show more ──→]          │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Rules / Guidelines                 │
 * ├────────────────────────────────────┤
 * │ Rule content rendered as markdown, │
 * │ clamped to max lines               │
 * │ [Show more ──→]                    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────┐
 * │ Rules / Guidelines                   │
 * ├──────────────────────────────────────┤
 * │ Rule content rendered as markdown,   │
 * │ clamped to max lines                 │
 * │ [Show more ──→]                      │
 * └──────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop - full width section
 */
export interface RuleSectionProps {
  realmUnitId: string;
  empty?: "hidden" | "state";
}

export const RuleSection: React.FC<RuleSectionProps> = ({
  realmUnitId,
  empty,
}) => <RealmRuleSummaryCard realmUnitId={realmUnitId} empty={empty} />;
