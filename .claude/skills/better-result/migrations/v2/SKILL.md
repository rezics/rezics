---
name: better-result-migrate-v2
description: Migrate existing better-result TaggedError code from v1 classes to v2 factories.
---

# better-result v2 Migration

Migrate existing `better-result` TaggedError code from v1 to v2.

## Repository Guardrail

This skill is for migration of **existing** `better-result` code. It is not a justification to introduce `better-result` into new modules.

Use this skill only when:

- The user explicitly asks for a `better-result` v1 to v2 migration
- The target files already contain `better-result` TaggedError code

If the target area does not already use `better-result`, do not apply this skill.

## When to Use

- Upgrading existing `better-result` TaggedError classes
- Rewriting `TaggedError.match` helpers to the v2 standalone helpers
- Normalizing old constructor patterns in code that already depends on `better-result`

## V1 API

```typescript
class FooError extends TaggedError {
  readonly _tag = 'FooError' as const;
  constructor(readonly id: string) {
    super(`Foo: ${id}`);
  }
}

TaggedError.match(err, { ... });
TaggedError.matchPartial(err, { ... }, fallback);
TaggedError.isTaggedError(value);
```

## V2 API

```typescript
class FooError extends TaggedError('FooError')<{
  id: string;
  message: string;
}>() {}

matchError(err, { ... });
matchErrorPartial(err, { ... }, fallback);
isTaggedError(value);
TaggedError.is(value);
FooError.is(value);
```

## Migration Rules

### 1. Simple Class

```typescript
// BEFORE
class FooError extends TaggedError {
  readonly _tag = 'FooError' as const;
  constructor(readonly id: string) {
    super(`Foo: ${id}`);
  }
}

// AFTER
class FooError extends TaggedError('FooError')<{
  id: string;
  message: string;
}>() {}
```

Usage changes from `new FooError('123')` to `new FooError({ id: '123', message: 'Foo: 123' })`.

### 2. Computed Message

```typescript
// BEFORE
class NotFoundError extends TaggedError {
  readonly _tag = 'NotFoundError' as const;
  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`${resource} not found: ${id}`);
  }
}

// AFTER
class NotFoundError extends TaggedError('NotFoundError')<{
  resource: string;
  id: string;
  message: string;
}>() {
  constructor(args: { resource: string; id: string }) {
    super({ ...args, message: `${args.resource} not found: ${args.id}` });
  }
}
```

### 3. Constructor Validation

```typescript
// BEFORE
class ValidationError extends TaggedError {
  readonly _tag = 'ValidationError' as const;
  constructor(readonly field: string) {
    if (!field) throw new Error('field required');
    super(`Invalid: ${field}`);
  }
}

// AFTER
class ValidationError extends TaggedError('ValidationError')<{
  field: string;
  message: string;
}>() {
  constructor(args: { field: string }) {
    if (!args.field) throw new Error('field required');
    super({ ...args, message: `Invalid: ${args.field}` });
  }
}
```

### 4. Runtime Properties

```typescript
// BEFORE
class TimestampedError extends TaggedError {
  readonly _tag = 'TimestampedError' as const;
  readonly timestamp = Date.now();
  constructor(readonly reason: string) {
    super(reason);
  }
}

// AFTER
class TimestampedError extends TaggedError('TimestampedError')<{
  reason: string;
  timestamp: number;
  message: string;
}>() {
  constructor(args: { reason: string }) {
    super({ ...args, message: args.reason, timestamp: Date.now() });
  }
}
```

### 5. Static Helper Migration

| V1                                                  | V2                                           |
| --------------------------------------------------- | -------------------------------------------- |
| `TaggedError.match(err, handlers)`                  | `matchError(err, handlers)`                  |
| `TaggedError.matchPartial(err, handlers, fallback)` | `matchErrorPartial(err, handlers, fallback)` |
| `TaggedError.isTaggedError(x)`                      | `isTaggedError(x)` or `TaggedError.is(x)`    |

### 6. Import Migration

```typescript
// BEFORE
import { TaggedError } from 'better-result';

// AFTER
import { TaggedError, isTaggedError, matchError, matchErrorPartial } from 'better-result';
```

## Workflow

1. Confirm the target files already use `better-result`, or the user explicitly requested this migration.
2. Find `extends TaggedError`, `_tag`, and legacy static helper usage.
3. Convert each class to the v2 factory form.
4. Preserve custom constructor logic where message derivation or validation exists.
5. Update call sites from positional constructor args to object args.
6. Replace legacy static helpers with v2 helper functions.
7. Update imports.
8. Run focused verification on affected files or tests if available.

## Pitfalls

- Applying this migration in modules that never used `better-result`
- Accidentally changing public error shapes beyond the intended migration
- Forgetting to update call sites after constructor signature changes
- Dropping validation or computed message logic during conversion
