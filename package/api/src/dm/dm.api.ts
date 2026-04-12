import type { DmSendBody } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const dmApi = {
  send: async (input: DmSendBody): Promise<{ success: true }> => {
    return apiFetch<{ success: true }>("/dm/send", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
