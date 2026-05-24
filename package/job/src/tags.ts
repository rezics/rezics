export type JobTag =
  | `domain:${string}`
  | `effect:${string}`
  | `index:${string}`
  | `entity:${string}`
  | `target:${string}`
  | `fanout:${string}`
  | `source:${string}`
  | `maintenance:${string}`;

export const jobTags = {
  domain: (domain: string): JobTag => `domain:${domain}`,
  effect: (effect: string): JobTag => `effect:${effect}`,
  index: (index: string): JobTag => `index:${index}`,
  entity: (entity: string): JobTag => `entity:${entity}`,
  target: (target: string): JobTag => `target:${target}`,
  fanout: (fanout: string): JobTag => `fanout:${fanout}`,
  source: (source: string): JobTag => `source:${source}`,
  maintenance: (operation: string): JobTag => `maintenance:${operation}`,
};

export function uniqueTags(tags: readonly JobTag[]): JobTag[] {
  return [...new Set(tags)];
}
