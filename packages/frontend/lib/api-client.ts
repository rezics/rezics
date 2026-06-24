import { treaty } from "@elysiajs/eden";
import type { Elysia } from "elysia";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export function createEdenClient<App extends Elysia>(baseUrl = API_BASE_URL) {
  return treaty<App>(baseUrl);
}
