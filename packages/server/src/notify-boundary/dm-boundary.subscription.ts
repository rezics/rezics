/**
 * Predicate: does the sender's Subscription to the recipient permit DM?
 *
 * A Subscription's `channels` permits DM if it contains the global wildcard
 * `'*'`, the DM category wildcard `'dm.*'`, or the exact event `'dm.message'`.
 * This collapses
 * "I follow you" and "I'll let you DM me" into one edge with channel
 * filtering — see `CHANNEL_REGISTRY.USER` in `@rezics/contract`.
 */
export function subscriptionPermitsDm(channels: readonly string[]): boolean {
  return (
    channels.includes("*") ||
    channels.includes("dm.*") ||
    channels.includes("dm.message")
  );
}
