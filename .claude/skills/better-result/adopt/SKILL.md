---
name: better-result-adopt
description: Adopt `better-result` only for explicit opt-in work. In this repository, do not propose or introduce the library unless the user asks for it or the target code already uses it.
---

# better-result Adoption

Adopt `better-result` in existing code only when the task explicitly calls for it.

## Repository Guardrail

For this repository, `better-result` is **not** the default pattern.

Before applying anything in this skill, verify one of the following:

- The user explicitly asked to use `better-result`
- The user explicitly asked for Result-based or TaggedError-based refactoring
- The target module already uses `better-result`

If none of these are true, stop and use the surrounding codebase conventions instead.

## When to Use

- Explicit adoption of `better-result` in an existing area
- Converting a module that already uses `better-result` to be more consistent
- Refactoring thrown exceptions to Result types because the user requested that style
- Introducing TaggedError models because the user explicitly asked for them

## When Not to Use

- Routine bug fixes
- New feature work in modules that do not already use `better-result`
- Generic cleanup or refactoring requests that do not mention the library
- Cases where ordinary TypeScript unions or existing project patterns are simpler

## Adoption Strategy

### 1. Limit Scope

Apply `better-result` only to the requested module or boundary. Do not spread the pattern through unrelated packages.

### 2. Start at Boundaries

Begin at I/O boundaries such as API calls, DB queries, or file operations, then move inward only as needed.

### 3. Preserve Existing Architecture

Do not force Result types through layers that are not part of the requested change. Keep interop explicit at the edge of the refactor.

## Error Categories

Before migrating, classify errors in the target code:

| Category       | Example                | Suggested Mapping                             |
| -------------- | ---------------------- | --------------------------------------------- |
| Domain errors  | NotFound, Validation   | TaggedError + `Result.err`                    |
| Infrastructure | Network, DB connection | `Result.tryPromise` + TaggedError             |
| Bugs/defects   | null deref, type error | Leave as thrown defects unless task says otherwise |

## Pattern Transformations

### Try/Catch to `Result.try`

```typescript
// BEFORE
function parseConfig(json: string): Config {
  try {
    return JSON.parse(json);
  } catch (e) {
    throw new ParseError(e);
  }
}

// AFTER
function parseConfig(json: string): Result<Config, ParseError> {
  return Result.try({
    try: () => JSON.parse(json) as Config,
    catch: (e) => new ParseError({ cause: e, message: `Parse failed: ${e}` }),
  });
}
```

### Async/Await to `Result.tryPromise`

```typescript
// BEFORE
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new ApiError(res.status);
  return res.json();
}

// AFTER
async function fetchUser(id: string): Promise<Result<User, ApiError | UnhandledException>> {
  return Result.tryPromise({
    try: async () => {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new ApiError({ status: res.status, message: `API ${res.status}` });
      return res.json() as Promise<User>;
    },
    catch: (e) => (e instanceof ApiError ? e : new UnhandledException({ cause: e })),
  });
}
```

### Null Checks to `Result`

```typescript
// BEFORE
function findUser(id: string): User | null {
  return users.find((u) => u.id === id) ?? null;
}

// AFTER
function findUser(id: string): Result<User, NotFoundError> {
  const user = users.find((u) => u.id === id);
  return user
    ? Result.ok(user)
    : Result.err(new NotFoundError({ id, message: `User ${id} not found` }));
}
```

### Imperative Flow to `Result.gen`

```typescript
// BEFORE
async function processOrder(orderId: string) {
  try {
    const order = await fetchOrder(orderId);
    if (!order) throw new NotFoundError(orderId);
    const validated = validateOrder(order);
    if (!validated.ok) throw new ValidationError(validated.errors);
    return await submitOrder(validated.data);
  } catch (e) {
    if (e instanceof NotFoundError) return { error: 'not_found' };
    if (e instanceof ValidationError) return { error: 'invalid' };
    throw e;
  }
}

// AFTER
async function processOrder(orderId: string): Promise<Result<OrderResult, OrderError>> {
  return Result.gen(async function* () {
    const order = yield* Result.await(fetchOrder(orderId));
    const validated = yield* validateOrder(order);
    const result = yield* Result.await(submitOrder(validated));
    return Result.ok(result);
  });
}
```

## Defining Tagged Errors

See [references/tagged-errors.md](references/tagged-errors.md) for TaggedError patterns.

## Workflow

1. Confirm that this task is explicitly opting into `better-result`.
2. Audit the target module for thrown errors, `try/catch`, rejected promises, and boundary functions.
3. Define TaggedError models only for the requested scope.
4. Wrap boundary operations with `Result.try` or `Result.tryPromise`.
5. Convert local control flow to `Result` chaining or `Result.gen` where it improves clarity.
6. Update signatures only as far as the requested refactor needs.
7. Keep adapters at the edge when callers outside the scope still expect old patterns.
8. Verify both success and error paths.

## Common Pitfalls

- Over-scoping the refactor across unrelated modules
- Introducing `better-result` into code that did not opt into it
- Rewriting healthy code just for stylistic consistency
- Losing cause or context when creating TaggedErrors
- Mixing `Result` returns and thrown exceptions without a clear boundary

## References

- [TaggedError Patterns](references/tagged-errors.md)
