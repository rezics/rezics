import { t } from 'elysia';

export const createBookSchema = t.Object({
  title: t.String(),
  author: t.String(),
  isbn: t.Optional(t.String()),
  cover: t.Optional(t.String()),
  description: t.Optional(t.String()),
});

export const updateBookSchema = t.Object({
  title: t.Optional(t.String()),
  author: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  cover: t.Optional(t.String()),
  description: t.Optional(t.String()),
});

export const bookParamsSchema = t.Object({
  id: t.Numeric(),
});
