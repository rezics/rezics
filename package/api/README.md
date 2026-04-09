# @rezics/api

Frontend API client layer for the Rezics platform. Wraps backend endpoints into [TanStack Query](https://tanstack.com/query) hooks, query options, and mutations for use in React applications.

## Overview

This package provides a domain-organized API layer that connects the frontend to `@rezics/server` and `@rezics/auth`. All types come from `@rezics/contract` — there is no type duplication in this package.

## Setup

Call `configureApi` once at application startup before any API function is used:

```typescript
import { configureApi } from '@rezics/api/config';

configureApi({
  apiBaseUrl: 'https://api.example.com',
  authBaseUrl: 'https://auth.example.com',
});
```

## Domains

Each domain follows a consistent structure:

| File              | Purpose                              |
| ----------------- | ------------------------------------ |
| `{domain}.ts`     | Main entry — re-exports all parts    |
| `{domain}.api.ts` | HTTP request functions               |
| `{domain}.keys.ts`| TanStack Query cache key factories   |
| `{domain}.queries.ts` | `queryOptions` factories         |
| `{domain}.mutations.ts` | Mutation hooks                 |
| `{domain}.types.ts` | Domain-specific types (if needed)  |

Available domains: `auth`, `book`, `chapter`, `comment`, `feedback`, `jwt-service`, `meili`, `reaction`, `readlist`, `review`, `stats`, `tag`, `token`, `unit`, `upload`, `user`.

## Usage

```typescript
import { bookQueries } from '@rezics/api/book';
import { useQuery } from '@tanstack/react-query';

const { data } = useQuery(bookQueries.byId(bookId));
```

## Tech Stack

- [TanStack Query](https://tanstack.com/query) for data fetching, caching, and synchronization
- [TanStack Query Persist Client](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient) for offline persistence
- Types from `@rezics/contract`
