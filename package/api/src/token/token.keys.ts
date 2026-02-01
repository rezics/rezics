/**
 * React Query key factory for Token queries
 * Follows the pattern used in other API modules (e.g. tag, comment).
 */

export const tokenKeys = {
  /** Base key for all token queries */
  all: () => ['tokens'] as const,

  /** Keys for listing tokens of the current user */
  lists: () => [...tokenKeys.all(), 'list'] as const,
  list: () => [...tokenKeys.lists()] as const,

  /** Keys for individual token detail (by id) */
  details: () => [...tokenKeys.all(), 'detail'] as const,
  detail: (id: string) => [...tokenKeys.details(), id] as const,
} as const;
