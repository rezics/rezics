# @rezics/jwt

JWT creation, verification, and key rotation utilities for the Rezics platform. Designed for integration with [Elysia](https://elysiajs.com) backend services.

## Overview

A modular JWT library built on [Jose](https://github.com/panva/jose) that provides composable verification, claims validation, key rotation strategies, and adapter patterns for different JWT sources. Used by both `@rezics/server` and `@rezics/auth`.

## Exports

| Entry Point    | Description                                          |
| -------------- | ---------------------------------------------------- |
| `.`            | All exports (re-exports all sub-modules)             |
| `./core`       | JWT algorithms, verification, claims, error types    |
| `./contracts`  | Token claim types and schemas                        |
| `./rotation`   | Key rotation strategies and utilities                |
| `./adapters`   | Integration adapters for different JWT sources       |

## Usage

```typescript
import { verifyToken } from '@rezics/jwt/core';
import { createRotationStrategy } from '@rezics/jwt/rotation';

// Verify a JWT token
const claims = await verifyToken(token, {
  issuer: 'https://auth.example.com',
  audience: 'rezics-server',
});
```

## Features

- **Token Verification** — JWT verification with configurable clock tolerance
- **Multiple Algorithms** — Support for ES256, RS256, and other standard algorithms
- **Key Rotation** — Strategies for rotating signing keys without downtime
- **Claims Validation** — Structured claim types with runtime validation
- **Adapter Pattern** — Pluggable JWT source resolution for different services

## Tech Stack

- [Jose](https://github.com/panva/jose) for JWT/JWK/JWKS operations
- [Elysia](https://elysiajs.com) as peer dependency for server integration
- Types from `@rezics/contract`
