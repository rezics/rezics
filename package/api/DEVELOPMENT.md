# Development Notes

## API Layer Refactoring

### Overview

The API layer was refactored with the following goals:

1. **Unified type definitions** — All DTO and input types are defined in `@rezics/contract`
2. **Simplified API functions** — Removed unnecessary type conversions and data overloads
3. **Shared types** — Backend response structures are used directly by the frontend

### File Structure

Each API domain file contains three parts:

1. **Query Keys** — TanStack Query cache keys
2. **API Functions** — HTTP request functions
3. **Query Options** — TanStack Query `queryOptions` factory functions

### Migration Guide

**Update imports:**

```typescript
// Before
import { type BookDTO } from '@/api/Book';

// After
import { type BookDTO } from '@rezics/contract';
```

**Remove data transforms:**

```typescript
// Before — select transform in query options
export const bookQueries = {
  byId: (id: string) =>
    queryOptions({
      queryKey: bookKeys.detail(id),
      queryFn: () => bookApi.get(id),
      select: (b) => ({ id: String(b.id ?? id), title: String(b.title ?? '') }),
    }),
};

// After — direct usage
export const bookQueries = {
  byId: (id: string) =>
    queryOptions({
      queryKey: bookKeys.detail(id),
      queryFn: () => bookApi.get(id),
    }),
};
```

### Notes

- Backend must ensure response structures match `@rezics/contract` definitions
- If data transformation is needed, handle it at the component level, not the API layer
- Pagination types use `OffsetPaginated<T>` or `CursorPaginated<T>`
