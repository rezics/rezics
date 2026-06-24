import { t } from "elysia";

export const slugSchema = t.String({
  minLength: 6,
  maxLength: 36,
  pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
});
