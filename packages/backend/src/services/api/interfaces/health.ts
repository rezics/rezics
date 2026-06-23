import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

export class HealthGroup extends HttpApiGroup.make("health", {
  topLevel: true,
}).add(
  HttpApiEndpoint.get("health", "/health", {
    success: HttpApiSchema.NoContent,
  }),
) {}
