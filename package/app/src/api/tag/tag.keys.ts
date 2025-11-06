import type {TagFilters} from './tag.types';

export const tagKeys = {
  all: () => ['tags'] as const,

  // list keys
  lists: () => [...tagKeys.all(), 'list'] as const,
  list: (filters?: TagFilters) => [...tagKeys.lists(), filters] as const,

  // detail
  details: () => [...tagKeys.all(), 'detail'] as const,
  detail: (unitId: string) => [...tagKeys.details(), unitId] as const,

  // by name within domain
  byName: (name: string, type?: string | null, domainId?: string) =>
    [...tagKeys.all(), 'byName', {name, type, domainId}] as const,

  // by object (e.g. tags for a book/unit)
  byObject: (objectId: string) =>
    [...tagKeys.all(), 'object', objectId] as const,
} as const;
