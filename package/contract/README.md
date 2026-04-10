# @rezics/contract

Shared TypeScript API contracts for the Rezics platform. Defines data schemas and types used by both the backend (Elysia) and frontend (TanStack Query) to ensure end-to-end type safety.

## Overview

This package is the single source of truth for all API data structures. Schemas are defined using [TypeBox](https://github.com/sinclairzx81/typebox) via Elysia's `t` schema builder, providing both runtime validation and static TypeScript types from the same definition.

## Domains

| Schema        | Description                       |
| ------------- | --------------------------------- |
| `auth`        | Authentication and session types  |
| `book`        | Book metadata and listing types   |
| `chapter`     | Chapter content and structure     |
| `comment`     | User comments                     |
| `feedback`    | User feedback submissions         |
| `jwt-service` | JWT service metadata              |
| `meili`       | Meilisearch index and query types |
| `pagination`  | Offset and cursor pagination      |
| `permission`  | Access control and role types     |
| `reaction`    | Content reactions                 |
| `readlist`    | Reading list collections          |
| `review`      | Book reviews                      |
| `search`      | Search query and result types     |
| `tag`         | Content tagging                   |
| `token`       | Token issuance and claims         |
| `unit`        | Content units                     |
| `upload`      | File upload types                 |
| `user`        | User profiles                     |
| `admin-stats` | Admin dashboard statistics        |

## Usage

```typescript
import { type BookDTO, bookDTOSchema } from '@rezics/contract';
```

All schemas are re-exported from the package root.

## Decision

- Don't use prisma box

## Tech Stack

- [TypeBox](https://github.com/sinclairzx81/typebox) (via Elysia `t`) for schema definitions
- Runtime validation on the backend, static types on the frontend
