# Legacy Frontend Source

`packages/app/src` is retained only as the migration source for the Next.js
frontend in `packages/frontend`.

Do not add new runtime entrypoints here. Move surviving user-facing workflows
into `packages/frontend` and delete the corresponding legacy source once the
Next.js route is verified.
