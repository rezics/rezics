import type { InternalDmBody } from "@rezics/contract";
import { sendDm } from "./notify-boundary.client";

export async function deliverDm(dm: InternalDmBody) {
  return sendDm(dm);
}
