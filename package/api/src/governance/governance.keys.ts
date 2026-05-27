export const governanceKeys = {
  all: () => ["governance"] as const,
  capabilityHints: () => [...governanceKeys.all(), "capability-hints"] as const,
} as const;
